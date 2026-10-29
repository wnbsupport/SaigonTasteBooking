'use strict';
// Bookings in the manager app. Staff only see restaurants assigned to them.
const express = require('express');
const { db } = require('../db');
const R = require('../lib/rules');
const store = require('../lib/store');
const B = require('../lib/bookings');
const { requireAuth } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

/** Which restaurants a request covers: ?restaurant=all|<id>, limited to what the user may see. */
function scope(req) {
  const want = String(req.query.restaurant || req.body && req.body.restaurant || 'all');
  if (want === 'all') return req.user.restaurantIds;
  const id = parseInt(want, 10);
  return req.user.restaurantIds.includes(id) ? [id] : [];
}

/** Visits and no-shows per phone number across the restaurants the user can see. */
async function guestStats(phones, rids) {
  const out = {};
  if (!phones.length || !rids.length) return out;
  const rows = await db()('bookings').whereIn('phone', [...new Set(phones)]).whereIn('restaurant_id', rids).whereIn('status', ['seated', 'noshow'])
    .select('phone', 'status').count({ n: '*' }).groupBy('phone', 'status');
  for (const r of rows) {
    const o = out[r.phone] || (out[r.phone] = { seated: 0, noshow: 0 });
    o[r.status] = Number(r.n);
  }
  return out;
}
async function withGuests(rows, rids) {
  const stats = await guestStats(rows.map(r => r.phone), rids);
  return rows.map(r => {
    const s = B.serialize(r);
    const g = stats[r.phone] || { seated: 0, noshow: 0 };
    // do not count this booking itself
    s.guest = { seated: g.seated - (r.status === 'seated' ? 1 : 0), noshow: g.noshow - (r.status === 'noshow' ? 1 : 0) };
    return s;
  });
}

router.get('/', async (req, res) => {
  const rids = scope(req);
  const date = String(req.query.date || '');
  if (!R.isDate(date)) return res.status(400).json({ error: 'date' });
  const rows = rids.length ? await db()('bookings').whereIn('restaurant_id', rids).where({ date }).orderBy('time_min').orderBy('id') : [];
  res.json({ date, bookings: await withGuests(rows, req.user.restaurantIds) });
});

router.get('/pending', async (req, res) => {
  const rids = scope(req);
  const rows = rids.length ? await db()('bookings').whereIn('restaurant_id', rids).where({ status: 'pending' }).orderBy('starts_at').limit(300) : [];
  res.json({ bookings: await withGuests(rows, req.user.restaurantIds) });
});

/** Light endpoint polled every ~15 s by the app (sent with X-Background: 1 so it does not keep the session awake). */
router.get('/summary', async (req, res) => {
  const rids = req.user.restaurantIds;
  if (!rids.length) return res.json({ pending: 0, unseen: [], version: '0' });
  const k = db();
  const [{ n }] = await k('bookings').whereIn('restaurant_id', rids).where({ status: 'pending' }).count({ n: '*' });
  const unseen = await k('bookings').whereIn('restaurant_id', rids).where({ seen: false }).orderBy('created_at', 'desc').limit(20);
  const [{ v, c }] = await k('bookings').whereIn('restaurant_id', rids).max({ v: 'updated_at' }).count({ c: '*' });
  res.json({ pending: Number(n), unseen: unseen.map(B.serialize), version: `${Number(v) || 0}-${Number(c)}` });
});

router.post('/seen', async (req, res) => {
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter(Number.isFinite).slice(0, 200);
  if (ids.length) await db()('bookings').whereIn('id', ids).whereIn('restaurant_id', req.user.restaurantIds).where({ seen: false }).update({ seen: true, updated_at: Date.now() });
  res.json({ ok: true });
});

router.get('/guest', async (req, res) => {
  const phone = R.normPhone(req.query.phone);
  if (!phone) return res.json({ bookings: [] });
  const rows = await db()('bookings').where({ phone }).whereIn('restaurant_id', req.user.restaurantIds).orderBy('starts_at', 'desc').limit(30);
  res.json({ bookings: rows.map(B.serialize) });
});

const csvCell = v => {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formulas
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
router.get('/export.csv', async (req, res) => {
  const rids = scope(req);
  const date = String(req.query.date || '');
  if (!R.isDate(date)) return res.status(400).send('date');
  const rows = rids.length ? await db()('bookings').whereIn('restaurant_id', rids).where({ date }).orderBy('time_min') : [];
  const names = Object.fromEntries((await store.listRestaurants()).map(r => [r.id, r.name]));
  const head = ['Date', 'Time', 'Restaurant', 'Name', 'Guests', 'Phone', 'Email', 'Status', 'Requests', 'Reference', 'Source'];
  const lines = [head.join(',')].concat(rows.map(b => [b.date, R.hm(b.time_min), names[b.restaurant_id], b.name, b.party, R.fmtPhone(b.phone), b.email, b.status, b.note, b.ref, b.source].map(csvCell).join(',')));
  await store.audit(req, 'csv_export', `${date} · ${rows.length}`);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="bookings-${date}.csv"`);
  res.set('Cache-Control', 'no-store');
  res.send('﻿' + lines.join('\r\n') + '\r\n');
});

router.post('/printed', async (req, res) => {
  const date = String(req.body.date || '');
  await store.audit(req, 'print', R.isDate(date) ? date : '');
  res.json({ ok: true });
});

/**
 * Guests seated through the day, per restaurant (for the day view), or – with ?time=HH:MM&party=n –
 * the busiest moment while a booking at that time would be at the table (for warnings before saving).
 */
router.get('/load', async (req, res) => {
  const rids = scope(req);
  const date = String(req.query.date || '');
  if (!R.isDate(date)) return res.status(400).json({ error: 'date' });
  const time = R.toMin(req.query.time);
  const ignore = parseInt(req.query.ignore, 10) || null;
  const out = [];
  for (const id of rids) {
    const r = await store.getRestaurant(id);
    const booked = await store.bookedFor(id, date, ignore);
    const base = { restaurantId: id, cap: r.rules.cap, stay: r.rules.stay, stayEvening: r.rules.stayEvening };
    if (time != null) {
      const party = Math.max(0, parseInt(req.query.party, 10) || 0);
      out.push({ ...base, time: R.hm(time), stayHere: R.stayFor(r.rules, time), peak: R.peakDuring(r.rules, booked, time), party });
      continue;
    }
    const { sessions } = R.sessionsFor(r, await store.specialsFor(id), date);
    const slots = [];
    for (const [open, close] of sessions) {
      for (let m = open; m < close; m += r.rules.interval) slots.push({ time: R.hm(m), guests: R.seatedAt(r.rules, booked, m) });
    }
    out.push({ ...base, slots });
  }
  res.json({ date, restaurants: out });
});

router.get('/:id', async (req, res) => {
  const k = db();
  const b = await k('bookings').where({ id: Number(req.params.id) }).first();
  if (!b || !req.user.restaurantIds.includes(b.restaurant_id)) return res.status(404).json({ error: 'not_found' });
  const [s] = await withGuests([b], req.user.restaurantIds);
  const events = await k('booking_events').where({ booking_id: b.id }).orderBy('id');
  const emails = await k('emails').where({ booking_id: b.id }).orderBy('id').select('id', 'kind', 'to_addr', 'subject', 'status', 'via', 'error', 'created_at', 'sent_at');
  const history = await k('bookings').where({ phone: b.phone }).whereNot({ id: b.id }).whereIn('restaurant_id', req.user.restaurantIds).orderBy('starts_at', 'desc').limit(30);
  res.json({
    booking: s,
    events: events.map(e => ({ at: Number(e.at), actor: e.actor, kind: e.kind, detail: e.detail })),
    emails: emails.map(e => ({ id: e.id, kind: e.kind, to: e.to_addr, subject: e.subject, status: e.status, via: e.via, error: e.error, at: Number(e.sent_at || e.created_at) })),
    history: history.map(B.serialize),
  });
});

/** Preview of the email the guest will get if staff confirm / decline now. */
router.post('/:id/preview', async (req, res) => {
  const b = await db()('bookings').where({ id: Number(req.params.id) }).first();
  if (!b || !req.user.restaurantIds.includes(b.restaurant_id)) return res.status(404).json({ error: 'not_found' });
  const kind = req.body.kind === 'decline' ? 'decline' : 'confirm';
  const r = await store.getRestaurant(b.restaurant_id);
  const tpl = require('../lib/templates');
  const mailer = require('../lib/mailer');
  const m = kind === 'confirm' ? tpl.bookingConfirmed(r, b) : tpl.bookingDeclined(r, { ...b, decline_reason: R.clean(req.body.reason, 250) });
  const own = mailer.restaurantReady(r) && r.mail_status !== 'failed';
  const sysFrom = require('../config').smtp.from;
  const addr = own ? r.smtp_user : sysFrom;
  res.json({ to: b.email, from: `${r.mail_from_name || r.name}${addr ? ` <${addr}>` : ''}`, replyTo: own ? '' : (mailer.restaurantReplyTo(r) || ''), subject: m.subject, html: m.html, ownMailbox: own });
});

router.post('/', async (req, res) => {
  const rid = parseInt(req.body.restaurantId, 10);
  if (!req.user.restaurantIds.includes(rid)) return res.status(404).json({ error: 'not_found' });
  const restaurant = await store.getRestaurant(rid);
  const out = await B.createBooking({ restaurant, input: req.body, mode: 'staff', user: req.user, override: !!req.body.override, sendConfirm: !!req.body.sendEmail, ip: req.ip, source: 'staff' });
  if (out.errors) return res.status(422).json({ errors: out.errors });
  await store.audit(req, 'booking_created_staff', `${out.booking.name} · ${restaurant.name} · ${out.booking.ref}${out.booking.override ? ' · override' : ''}`);
  res.status(201).json({ booking: B.serialize(out.booking) });
});

/**
 * Delete a booking for good (test or spam bookings). Owners: any booking. Staff: only bookings still pending.
 * Its history and stored emails go too; the activity log keeps a line saying what was deleted.
 */
router.delete('/:id', async (req, res) => {
  const k = db();
  const b = await k('bookings').where({ id: Number(req.params.id) }).first();
  if (!b || !req.user.restaurantIds.includes(b.restaurant_id)) return res.status(404).json({ error: 'not_found' });
  if (req.user.role !== 'owner' && b.status !== 'pending') return res.status(403).json({ error: 'forbidden' });
  const reason = R.clean(req.body && req.body.reason, 200);
  await k.transaction(async trx => {
    await trx('booking_events').where({ booking_id: b.id }).del();
    await trx('emails').where({ booking_id: b.id }).del();
    await trx('bookings').where({ id: b.id }).del();
  });
  const r = await store.getRestaurant(b.restaurant_id);
  await store.audit(req, 'booking_deleted', `${b.name} · ${r ? r.name : ''} · ${b.ref} · ${b.date} ${R.hm(b.time_min)} · ${b.status}${reason ? ' · ' + reason : ''}`);
  res.json({ ok: true });
});

router.post('/:id/:action', async (req, res) => {
  const action = req.params.action;
  if (!B.TRANSITIONS[action]) return res.status(404).json({ error: 'not_found' });
  const out = await B.transition(Number(req.params.id), action, req.user, { reason: req.body.reason });
  if (out.error) return res.status(out.status).json({ error: out.error, booking: out.booking });
  await store.audit(req, 'booking_' + action, `${out.booking.name} · ${out.restaurant.name} · ${out.booking.ref}${req.body.reason ? ' · ' + R.clean(req.body.reason, 200) : ''}`);
  res.json({ booking: out.booking });
});

/** One sent email, as the guest saw it. */
const emails = express.Router();
emails.use(requireAuth);
emails.get('/:id', async (req, res) => {
  const e = await db()('emails').where({ id: Number(req.params.id) }).first();
  const allowed = e && (e.restaurant_id ? req.user.restaurantIds.includes(e.restaurant_id) : req.user.role === 'owner' && !e.booking_id);
  if (!allowed) return res.status(404).json({ error: 'not_found' });
  res.json({ id: e.id, kind: e.kind, to: e.to_addr, from: e.from_addr, replyTo: e.reply_to, subject: e.subject, html: e.html, status: e.status, via: e.via, error: e.error, at: Number(e.sent_at || e.created_at) });
});

module.exports = { router, emails };
