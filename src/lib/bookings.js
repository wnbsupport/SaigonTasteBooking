'use strict';
// Creating bookings and moving them between statuses. Used by the public form API and the manager app.
const { db, isMysql } = require('../db');
const R = require('./rules');
const { refCode } = require('./crypto');
const store = require('./store');
const mailer = require('./mailer');
const tpl = require('./templates');
const log = require('./logger');

function serialize(b) {
  return {
    id: b.id, ref: b.ref, restaurantId: b.restaurant_id, date: b.date, time: R.hm(b.time_min), timeMin: b.time_min,
    startsAt: Number(b.starts_at), party: b.party, name: b.name, phone: b.phone, phoneFmt: R.fmtPhone(b.phone), email: b.email,
    note: b.note || '', status: b.status, source: b.source, declineReason: b.decline_reason, cancelReason: b.cancel_reason,
    override: !!b.override, seen: !!b.seen, remindedAt: b.reminded_at ? Number(b.reminded_at) : null,
    createdAt: Number(b.created_at), updatedAt: Number(b.updated_at),
  };
}

/**
 * Validate a booking. mode 'public' = guest form (strict), 'staff' = manager app.
 * Returns { errors, value }. Error values are codes the form/app turn into words.
 */
function validateInput(input, restaurant, mode) {
  const e = {};
  const v = {};
  if (mode === 'public') {
    v.first = R.clean(input.first, 60); v.last = R.clean(input.last, 60);
    if (!v.first) e.first = 'required';
    if (!v.last) e.last = 'required';
    v.name = `${v.first} ${v.last}`.trim();
    if (input.consent !== true && input.consent !== 'true' && input.consent !== 1 && input.consent !== '1') e.consent = 'required';
  } else {
    v.name = R.clean(input.name, 120);
    if (v.name.length < 2) e.name = 'required';
  }
  v.phone = R.normPhone(input.phone);
  if (!v.phone) e.phone = 'invalid';
  v.email = R.clean(input.email, 190).toLowerCase();
  if (mode === 'public' || v.email) { if (!R.emailOk(v.email)) e.email = 'invalid'; }
  v.party = parseInt(input.party, 10);
  const maxParty = mode === 'public' ? restaurant.rules.maxParty : 99;
  if (!(v.party >= 1 && v.party <= maxParty)) e.party = 'range';
  v.note = R.clean(input.note, 500);
  v.date = String(input.date || '');
  v.timeMin = R.toMin(input.time);
  if (!R.isDate(v.date) || v.timeMin == null) e.time = 'required';
  return { errors: e, value: v };
}

async function uniqueRef(k, prefix) {
  for (let i = 0; i < 6; i++) {
    const ref = refCode(prefix);
    if (!(await k('bookings').where({ ref }).first())) return ref;
  }
  throw new Error('Could not create a unique booking reference');
}

/**
 * Create a booking. Checks time rules, capacity and duplicates inside one transaction
 * (on MySQL the restaurant row is locked so two guests cannot take the last seats at once).
 */
async function createBooking({ restaurant, input, mode, user = null, override = false, sendConfirm = false, ip = '', source }) {
  const { errors, value: v } = validateInput(input, restaurant, mode);
  if (Object.keys(errors).length) return { errors };
  const allowOverride = mode === 'staff' && override && user && user.role === 'owner';
  const t = Date.now();
  let created;
  try {
    created = await db().transaction(async trx => {
      let rq = trx('restaurants').where({ id: restaurant.id });
      if (isMysql()) rq = rq.forUpdate();
      const fresh = store.parseRestaurant(await rq.first());
      if (!allowOverride) {
        const specials = await store.specialsFor(fresh.id, trx);
        const booked = await store.bookedFor(fresh.id, v.date, null, trx);
        const sl = R.slotsFor({ restaurant: fresh, specials, date: v.date, party: v.party, booked, now: t });
        if (mode === 'public' && sl.state === 'paused') throw Object.assign(new Error('paused'), { errors: { time: 'paused' } });
        // Staff (phone bookings) may use any minute inside opening hours, even while online booking is paused,
        // and without the minimum notice. Guests can only pick the offered slots.
        const hit = mode === 'staff'
          ? staffSlot(fresh, specials, v, booked, t)
          : sl.groups.flatMap(g => g.slots).find(s => s.min === v.timeMin);
        if (!hit) throw Object.assign(new Error('time'), { errors: { time: 'outside' } });
        if (hit.full) throw Object.assign(new Error('full'), { errors: { time: 'full' } });
      }
      const dup = await trx('bookings').where({ restaurant_id: fresh.id, date: v.date, phone: v.phone }).whereIn('status', ['pending', 'confirmed']).first();
      if (dup) throw Object.assign(new Error('dup'), { errors: { dup: mode === 'public' ? 'exists' : dup.ref } });
      const ref = await uniqueRef(trx, fresh.short_code);
      const row = {
        ref, restaurant_id: fresh.id, date: v.date, time_min: v.timeMin, starts_at: R.startsAt(fresh.timezone, v.date, v.timeMin), party: v.party,
        name: v.name, phone: v.phone, email: v.email, note: v.note, status: mode === 'staff' ? 'confirmed' : 'pending',
        source: source || (mode === 'staff' ? 'staff' : 'web'), override: !!allowOverride, seen: mode === 'staff',
        created_by: user ? user.id : null, ip: String(ip).slice(0, 64), created_at: t, updated_at: t,
      };
      const [id] = await trx('bookings').insert(row);
      await store.event(id, mode === 'staff' ? user.name : 'guest', mode === 'staff' ? (allowOverride ? 'created_override' : 'created_staff') : 'created_web', '', trx);
      return { ...row, id, restaurant: fresh };
    });
  } catch (e) {
    if (e.errors) return { errors: e.errors };
    throw e;
  }
  const r = created.restaurant;
  const b = { ...created };
  delete b.restaurant;
  try {
    if (mode === 'public') {
      if (R.emailOk(r.email)) {
        const m = tpl.newBookingAlert(r, b);
        await mailer.queue({ kind: 'staff_new', sender: 'system', restaurantId: r.id, bookingId: b.id, to: r.email, subject: m.subject, html: m.html, text: m.text });
      }
    } else if (sendConfirm && b.email) {
      const m = tpl.bookingConfirmed(r, b);
      await mailer.queue({ kind: 'confirm', sender: 'restaurant', restaurantId: r.id, bookingId: b.id, to: b.email, subject: m.subject, html: m.html, text: m.text });
      await store.event(b.id, user.name, 'email_confirm', b.email);
    }
  } catch (err) { log.error('Queue email after booking', err); }
  return { booking: b, restaurant: r };
}

function staffSlot(r, specials, v, booked, now) {
  const sc = R.sessionsFor(r, specials, v.date);
  const inside = sc.sessions.some(([a, b]) => v.timeMin >= a && v.timeMin <= b - Math.min(r.rules.lastBefore, b - a));
  if (!inside) return null;
  if (R.startsAt(r.timezone, v.date, v.timeMin) < now - 15 * 60000) return null; // not in the past
  return { min: v.timeMin, full: R.overCap(r.rules, booked, v.timeMin, v.party) };
}

const TRANSITIONS = {
  confirm: { from: ['pending'], to: 'confirmed' },
  decline: { from: ['pending'], to: 'declined' },
  cancel: { from: ['confirmed'], to: 'cancelled' },
  seated: { from: ['confirmed'], to: 'seated' },
  noshow: { from: ['confirmed'], to: 'noshow' },
  undo: { from: ['seated', 'noshow'], to: 'confirmed' },
};

/** Change a booking's status. Returns { booking } or { error, status }. */
async function transition(id, action, user, { reason = '' } = {}) {
  const tr = TRANSITIONS[action];
  if (!tr) return { error: 'action', status: 400 };
  const k = db();
  const b = await k('bookings').where({ id }).first();
  if (!b || !user.restaurantIds.includes(b.restaurant_id)) return { error: 'not_found', status: 404 };
  if (!tr.from.includes(b.status)) return { error: 'changed', status: 409, booking: serialize(b) };
  reason = R.clean(reason, 250);
  if (action === 'cancel' && !reason) return { error: 'reason', status: 400 };
  const patch = { status: tr.to, updated_at: Date.now(), seen: true };
  if (action === 'decline') patch.decline_reason = reason;
  if (action === 'cancel') patch.cancel_reason = reason;
  const n = await k('bookings').where({ id, status: b.status }).update(patch);
  if (!n) return { error: 'changed', status: 409 };
  const nb = { ...b, ...patch };
  await store.event(id, user.name, action, reason);
  const r = await store.getRestaurant(b.restaurant_id);
  if ((action === 'confirm' || action === 'decline') && nb.email) {
    const m = action === 'confirm' ? tpl.bookingConfirmed(r, nb) : tpl.bookingDeclined(r, nb);
    await mailer.queue({ kind: action, sender: 'restaurant', restaurantId: r.id, bookingId: id, to: nb.email, subject: m.subject, html: m.html, text: m.text });
    await store.event(id, user.name, 'email_' + action, nb.email);
  }
  return { booking: serialize(nb), restaurant: r };
}

module.exports = { serialize, validateInput, createBooking, transition, TRANSITIONS };
