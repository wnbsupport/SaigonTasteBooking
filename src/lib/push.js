'use strict';
// Web push notifications (Android Chrome, iPhone/iPad iOS 16.4+ when the app is on the home screen).
// VAPID keys are created on first use and kept in the database, so nothing needs to be set on SiteGround.
const webpush = require('web-push');
const config = require('../config');
const log = require('./logger');
const { db } = require('../db');
const store = require('./store');
const { sha256, encrypt, decrypt, hasKey } = require('./crypto');
const { fmtPhone } = require('./rules');

let keys = null;
let sender = (sub, payload, opts) => webpush.sendNotification(sub, payload, opts);

async function vapid() {
  if (keys) return keys;
  let k = await store.getSetting('vapid', null);
  if (!k) {
    const fresh = webpush.generateVAPIDKeys();
    k = { publicKey: fresh.publicKey, privateKey: hasKey() ? encrypt(fresh.privateKey) : fresh.privateKey, enc: hasKey() };
    await store.setSetting('vapid', k);
  }
  keys = { publicKey: k.publicKey, privateKey: k.enc ? decrypt(k.privateKey) : k.privateKey };
  return keys;
}
const subject = () => (config.smtp.from ? `mailto:${config.smtp.from}` : config.appUrl.startsWith('https://') ? config.appUrl : 'mailto:admin@example.com');

async function saveSubscription(userId, sub, userAgent = '') {
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000 || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return false;
  const row = { user_id: userId, endpoint: sub.endpoint, p256dh: String(sub.keys.p256dh).slice(0, 200), auth: String(sub.keys.auth).slice(0, 100), user_agent: String(userAgent).slice(0, 255), fail_count: 0 };
  const h = sha256(sub.endpoint);
  const n = await db()('push_subscriptions').where({ endpoint_hash: h }).update(row); // a device moves to whoever signed in on it last
  if (!n) await db()('push_subscriptions').insert({ ...row, endpoint_hash: h, created_at: Date.now() });
  return true;
}
const removeSubscription = (userId, endpoint) => db()('push_subscriptions').where({ user_id: userId, endpoint_hash: sha256(String(endpoint || '')) }).del();
const removeAllFor = userId => db()('push_subscriptions').where({ user_id: userId }).del();

/** Send to the given subscription rows. Gone devices (404/410) are removed. */
async function sendTo(rows, makePayload) {
  if (!rows.length) return { sent: 0, failed: 0 };
  const k = await vapid();
  let sent = 0, failed = 0;
  for (const s of rows) {
    try {
      await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(makePayload(s)), {
        TTL: 3600, urgency: 'high', vapidDetails: { subject: subject(), publicKey: k.publicKey, privateKey: k.privateKey }, timeout: 10000,
      });
      sent++;
      await db()('push_subscriptions').where({ id: s.id }).update({ last_ok_at: Date.now(), fail_count: 0 });
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) await db()('push_subscriptions').where({ id: s.id }).del();
      else {
        await db()('push_subscriptions').where({ id: s.id }).update({ fail_count: (s.fail_count || 0) + 1 });
        log.warn('Push failed:', e.statusCode || '', e.body || e.message);
      }
    }
  }
  return { sent, failed };
}

/** Devices of active users who can see this restaurant, with each user's language. */
async function subscriptionsFor(restaurantId) {
  return db()('push_subscriptions as p').join('users as u', 'u.id', 'p.user_id').where('u.active', true)
    .where(q => q.where('u.role', 'owner').orWhereExists(function () { this.select('*').from('user_restaurants as ur').whereRaw('ur.user_id = u.id').where('ur.restaurant_id', restaurantId); }))
    .select('p.*', 'u.lang');
}

const WD = { vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
function when(b, lang) {
  const d = new Date(`${b.date}T00:00:00Z`);
  const hm = `${String(Math.floor(b.time_min / 60)).padStart(2, '0')}:${String(b.time_min % 60).padStart(2, '0')}`;
  return `${hm} ${WD[lang][d.getUTCDay()]} ${b.date.slice(8)}/${b.date.slice(5, 7)}`;
}

/** kind: 'new' | 'remind' */
function bookingPayload(kind, r, b, lang, waitedMin) {
  const en = lang === 'en';
  const title = kind === 'new' ? (en ? `New booking · ${r.name}` : `Booking mới · ${r.name}`)
    : (en ? `Waiting ${waitedMin} min · ${r.name}` : `Chờ xác nhận ${waitedMin} phút · ${r.name}`);
  const body = `${b.name} · ${b.party} ${en ? 'guests' : 'khách'} · ${when(b, en ? 'en' : 'vi')}${b.note ? `\n${String(b.note).slice(0, 120)}` : ''}`;
  return { title, body, tag: `booking-${b.id}`, url: '/?view=pending', ts: Date.now() };
}

/** Fire-and-forget: never delays or breaks the booking itself. */
function notifyBooking(kind, r, b, waitedMin) {
  setImmediate(async () => {
    try {
      const rows = await subscriptionsFor(r.id);
      await sendTo(rows, s => bookingPayload(kind, r, b, s.lang, waitedMin));
    } catch (e) { log.error('Push notify failed', e); }
  });
}

async function sendTest(userId, lang, endpoint) {
  let q = db()('push_subscriptions').where({ user_id: userId });
  if (endpoint) q = q.where({ endpoint_hash: sha256(endpoint) });
  const rows = await q;
  const en = lang === 'en';
  return sendTo(rows, () => ({ title: 'Saigon Taste Booking', body: en ? 'Notifications are working on this device.' : 'Thông báo đã hoạt động trên thiết bị này.', tag: 'test', url: '/', ts: Date.now() }));
}

module.exports = { vapid, saveSubscription, removeSubscription, removeAllFor, notifyBooking, sendTest, bookingPayload, setSender(f) { sender = f; } };
