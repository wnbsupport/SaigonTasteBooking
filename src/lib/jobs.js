'use strict';
// Background work, every minute: expire unanswered requests, remind restaurants, retry emails, tidy old sessions.
const { db } = require('../db');
const store = require('./store');
const mailer = require('./mailer');
const tpl = require('./templates');
const log = require('./logger');
const deploys = require('./deploys');
const config = require('../config');

let running = false;
let timer = null;

async function expirePending(now = Date.now()) {
  const rows = await db()('bookings').where({ status: 'pending' }).where('starts_at', '<', now).limit(200);
  for (const b of rows) {
    const n = await db()('bookings').where({ id: b.id, status: 'pending' }).update({ status: 'expired', updated_at: now });
    if (!n) continue;
    await store.event(b.id, 'system', 'expired', '');
    const r = await store.getRestaurant(b.restaurant_id);
    await store.audit(null, 'booking_expired', `${b.name} · ${r ? r.name : ''} · ${b.ref}`, { actor: 'system', userId: null });
  }
  return rows.length;
}

async function sendReminders(now = Date.now()) {
  const rs = await store.listRestaurants();
  let sent = 0;
  for (const r of rs) {
    const mins = r.rules.remind;
    if (!mins) continue;
    const rows = await db()('bookings').where({ restaurant_id: r.id, status: 'pending' }).whereNull('reminded_at')
      .where('created_at', '<', now - mins * 60000).where('starts_at', '>', now).limit(50);
    for (const b of rows) {
      const n = await db()('bookings').where({ id: b.id }).whereNull('reminded_at').update({ reminded_at: now });
      if (!n) continue;
      const waited = Math.round((now - Number(b.created_at)) / 60000);
      require('./push').notifyBooking('remind', r, b, waited);
      const m = tpl.reminderAlert(r, b, waited);
      if (r.email) await mailer.queue({ kind: 'staff_remind', sender: 'system', restaurantId: r.id, bookingId: b.id, to: r.email, subject: m.subject, html: m.html, text: m.text });
      await store.event(b.id, 'system', 'reminded', String(mins));
      sent++;
    }
  }
  return sent;
}

async function tidy(now = Date.now()) {
  const A = require('./auth');
  await db()('sessions').where('remember', true).where('last_seen_at', '<', now - A.REMEMBER_DAYS * 864e5).del();
  await db()('sessions').where('remember', false).where('last_seen_at', '<', now - A.SHORT_DAYS * 864e5).del();
  await db()('tokens').where('expires_at', '<', now - 7 * 864e5).del();
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await expirePending();
    await sendReminders();
    await mailer.retryPending();
    await tidy();
  } catch (e) { log.error('Job tick failed', e); }
  finally { running = false; }
}

async function deployCleanup() {
  try {
    if (!config.deployCleanup || !(await store.getSetting('deploy_cleanup', true))) return;
    const res = await deploys.cleanup({ appDir: config.root });
    if (res.removed.length || res.errors.length) {
      await store.audit(null, 'deploy_cleanup', `removed ${res.removed.length}${res.errors.length ? ' · errors ' + res.errors.length : ''}`, { actor: 'system', userId: null });
    }
  } catch (e) { log.error('Deploy clean-up failed', e); }
}

function start() {
  if (timer) return;
  timer = setInterval(tick, 60000);
  setTimeout(tick, 5000);
  setTimeout(deployCleanup, 3 * 60000);           // a few minutes after start, so a fresh deploy is settled
  setInterval(deployCleanup, 24 * 3600e3);
}
function stop() { if (timer) clearInterval(timer); timer = null; }

module.exports = { start, stop, tick, expirePending, sendReminders, tidy, deployCleanup };
