'use strict';
// Sends email. Guest emails go out from the restaurant's own SiteGround mailbox;
// if that mailbox is not set up or fails, the system mailbox (env SMTP_*) sends instead,
// still showing the restaurant's name and with replies going to the restaurant.
// Every email is stored in the `emails` table first, so nothing is lost if sending fails; a job retries.
const nodemailer = require('nodemailer');
const config = require('../config');
const log = require('./logger');
const { db } = require('../db');
const { decrypt, sha256 } = require('./crypto');
const { getRestaurant } = require('./store');

const MAX_ATTEMPTS = 5;
const transports = new Map();
let factory = opts => nodemailer.createTransport(opts);

function transportFor(host, port, user, pass) {
  const key = sha256([host, port, user, pass].join('|'));
  if (!transports.has(key)) {
    transports.set(key, factory({
      host, port, secure: Number(port) === 465, requireTLS: Number(port) === 587, auth: { user, pass },
      connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
    }));
  }
  return transports.get(key);
}
const systemReady = () => !!(config.smtp.host && config.smtp.user && config.smtp.pass);
const restaurantReady = r => !!(r && r.smtp_host && r.smtp_user && r.smtp_pass_enc);
const quote = s => `"${String(s || '').replace(/["\\\r\n]/g, '')}"`;

/** Store an email and send it in the background. sender: 'restaurant' | 'system' */
async function queue({ kind, sender = 'system', restaurantId = null, bookingId = null, to, replyTo = '', subject, html, text = '' }) {
  const [id] = await db()('emails').insert({
    kind, restaurant_id: restaurantId, booking_id: bookingId, to_addr: String(to).slice(0, 190), reply_to: String(replyTo || '').slice(0, 190),
    subject: String(subject).slice(0, 255), html, text, status: 'pending', via: sender === 'restaurant' ? 'restaurant' : 'system', created_at: Date.now(),
  });
  if (module.exports.sync) await deliver(id); else setImmediate(() => deliver(id).catch(e => log.error('Email deliver', e)));
  return id;
}

async function deliver(id) {
  const k = db();
  const row = await k('emails').where({ id }).first();
  if (!row || row.status === 'sent' || row.status === 'logged') return row;
  const r = row.restaurant_id ? await getRestaurant(row.restaurant_id) : null;
  const msg = { to: row.to_addr, subject: row.subject, html: row.html, text: row.text || undefined };
  const attempts = row.attempts + 1;
  let lastErr = '';

  // Guest emails: restaurant mailbox first, then the system mailbox.
  // System emails (alerts, invites…): system mailbox first, then the restaurant's mailbox if the email belongs to one.
  const order = row.via === 'restaurant' ? ['restaurant', 'system'] : ['system', 'restaurant'];
  for (const way of order) {
    if (way === 'restaurant' && restaurantReady(r)) {
      try {
        const from = `${quote(r.mail_from_name || r.name)} <${r.smtp_user}>`;
        const replyTo = row.via === 'restaurant' ? (row.reply_to || undefined) : undefined;
        await transportFor(r.smtp_host, r.smtp_port, r.smtp_user, decrypt(r.smtp_pass_enc)).sendMail({ ...msg, from, replyTo });
        await k('emails').where({ id }).update({ status: 'sent', via: row.via === 'restaurant' ? 'restaurant' : 'restaurant_fb', from_addr: from.slice(0, 255), error: lastErr.slice(0, 255), attempts, sent_at: Date.now() });
        if (r.mail_status !== 'ok') await k('restaurants').where({ id: r.id }).update({ mail_status: 'ok', mail_error: '', mail_checked_at: Date.now() });
        return;
      } catch (e) {
        lastErr = (lastErr ? lastErr + ' · ' : '') + 'Hộp mail quán: ' + friendly(e);
        log.warn(`Restaurant mailbox failed (${r.name}):`, e.message);
        await k('restaurants').where({ id: r.id }).update({ mail_status: 'failed', mail_error: ('Hộp mail quán: ' + friendly(e)).slice(0, 255), mail_checked_at: Date.now() });
      }
    }
    if (way === 'system' && systemReady()) {
      try {
        const name = row.via === 'restaurant' && r ? (r.mail_from_name || r.name) : config.smtp.fromName;
        const from = `${quote(name)} <${config.smtp.from}>`;
        const replyTo = row.reply_to || (row.via === 'restaurant' && r ? r.email : undefined);
        await transportFor(config.smtp.host, config.smtp.port, config.smtp.user, config.smtp.pass).sendMail({ ...msg, from, replyTo });
        await k('emails').where({ id }).update({ status: 'sent', via: row.via === 'restaurant' ? 'fallback' : 'system', from_addr: from.slice(0, 255), error: lastErr.slice(0, 255), attempts, sent_at: Date.now() });
        return;
      } catch (e) {
        lastErr = (lastErr ? lastErr + ' · ' : '') + 'Hộp mail hệ thống: ' + friendly(e);
        log.warn('System mailbox failed:', e.message);
      }
    }
  }
  // 3) Nothing configured at all (local development): keep the email so it can be read in the app
  if (!lastErr && !systemReady() && !restaurantReady(r)) {
    await k('emails').where({ id }).update({ status: 'logged', via: 'log', attempts, error: 'Chưa cài hộp mail nên email chỉ được lưu, chưa gửi.' });
    return;
  }
  await k('emails').where({ id }).update({ status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', attempts, error: (lastErr || 'Chưa cài hộp mail gửi đi.').slice(0, 255) });
}

function friendly(e) {
  const m = String(e && (e.response || e.message) || e);
  if (/EAUTH|Invalid login|authentication failed|535/i.test(m)) return 'sai email hoặc mật khẩu SMTP';
  if (/ENOTFOUND|EAI_AGAIN/i.test(m)) return 'sai máy chủ SMTP';
  if (/ECONNREFUSED|ETIMEDOUT|ESOCKET|ECONNECTION|Greeting never received/i.test(m)) return 'không kết nối được máy chủ SMTP (kiểm tra máy chủ và cổng 465)';
  return m.slice(0, 160);
}

/** Check a restaurant's mailbox by sending a test email. Returns { ok, error }. */
async function testRestaurant(r, to) {
  if (!restaurantReady(r)) return { ok: false, error: 'Chưa nhập đủ máy chủ SMTP, email và mật khẩu.' };
  const { mailTest } = require('./templates');
  const m = mailTest(r);
  try {
    const tr = transportFor(r.smtp_host, r.smtp_port, r.smtp_user, decrypt(r.smtp_pass_enc));
    await tr.sendMail({ from: `${quote(r.mail_from_name || r.name)} <${r.smtp_user}>`, to, subject: m.subject, html: m.html, text: m.text });
    await db()('restaurants').where({ id: r.id }).update({ mail_status: 'ok', mail_error: '', mail_checked_at: Date.now() });
    return { ok: true };
  } catch (e) {
    const error = friendly(e);
    await db()('restaurants').where({ id: r.id }).update({ mail_status: 'failed', mail_error: ('Hộp mail quán: ' + error).slice(0, 255), mail_checked_at: Date.now() });
    return { ok: false, error };
  }
}

/** Retry emails that are still pending (job). */
async function retryPending() {
  const rows = await db()('emails').where({ status: 'pending' }).where('attempts', '>', 0).where('attempts', '<', MAX_ATTEMPTS).orderBy('id').limit(20);
  for (const r of rows) await deliver(r.id);
  // pending with 0 attempts older than 2 minutes: the process died before sending
  const stuck = await db()('emails').where({ status: 'pending', attempts: 0 }).where('created_at', '<', Date.now() - 120000).limit(20);
  for (const r of stuck) await deliver(r.id);
}

module.exports = {
  queue, deliver, testRestaurant, retryPending, systemReady, restaurantReady, friendly,
  setFactory(f) { factory = f; transports.clear(); },
  sync: false,
};
