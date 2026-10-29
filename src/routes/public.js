'use strict';
// Public booking API used by the WordPress plugin (with the restaurant's key) and by the hosted page /book/<slug>.
const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const net = require('net');
const R = require('../lib/rules');
const store = require('../lib/store');
const { sha256 } = require('../lib/crypto');
const { createBooking } = require('../lib/bookings');
const { refCode } = require('../lib/crypto');

const router = express.Router();

async function resolveRestaurant(req, res, next) {
  let r = null;
  if (req.params.slug) {
    r = await store.getRestaurantBy({ slug: String(req.params.slug).toLowerCase() });
    req.viaKey = false;
  } else {
    const m = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') || '');
    if (m) r = await store.getRestaurantBy({ api_key_hash: sha256(m[1]) });
    if (!r) return res.status(401).json({ error: 'key', message: 'Invalid or missing connection key.' });
    req.viaKey = true;
  }
  if (!r) return res.status(404).json({ error: 'not_found' });
  req.restaurant = r;
  // The WordPress plugin forwards the guest's IP; only trust it when the request carries a valid key.
  const fwd = req.get('x-client-ip');
  req.clientIp = req.viaKey && fwd && net.isIP(fwd) ? fwd : req.ip;
  next();
}

const keyOf = req => `${req.restaurant ? req.restaurant.id : 0}:${ipKeyGenerator(req.clientIp || req.ip || '')}`;
const msg = { error: 'rate', message: 'Too many requests. Please wait a few minutes and try again.' };
const readLimit = rateLimit({ windowMs: 10 * 60000, limit: 300, keyGenerator: keyOf, standardHeaders: 'draft-7', legacyHeaders: false, message: msg });
const bookLimit = rateLimit({ windowMs: 60 * 60000, limit: 10, keyGenerator: keyOf, standardHeaders: 'draft-7', legacyHeaders: false, message: msg });

function weekSummary(r) {
  return [1, 2, 3, 4, 5, 6, 0].map(d => ({ day: d, sessions: (R.parseSessions(r.week_hours[d]) || []).map(([a, b]) => ({ open: R.hm(a), close: R.hm(b) })) }));
}

async function info(req, res) {
  const r = req.restaurant;
  const specials = await store.specialsFor(r.id);
  const t = R.today(r.timezone);
  res.set('Cache-Control', 'no-store').json({
    name: r.name, phone: r.phone, phoneFmt: R.fmtPhone(r.phone), timezone: r.timezone, city: r.timezone.split('/')[1],
    online: r.online, today: t, maxDate: R.addDays(t, r.rules.maxDays), firstOpen: R.firstOpenDate({ restaurant: r, specials }),
    maxParty: r.rules.maxParty, privacyUrl: r.privacy_url || '', color: r.color,
    week: weekSummary(r),
    specials: specials.filter(s => s.date >= t).slice(0, 8).map(s => ({ date: s.date, note: s.note, sessions: (R.parseSessions(s.hours) || []).map(([a, b]) => ({ open: R.hm(a), close: R.hm(b) })) })),
  });
}

async function availability(req, res) {
  const r = req.restaurant;
  const date = String(req.body.date || '');
  if (!R.isDate(date)) return res.status(400).json({ error: 'date' });
  const party = Math.max(1, Math.min(r.rules.maxParty, parseInt(req.body.party, 10) || 1));
  const specials = await store.specialsFor(r.id);
  const covers = await store.coversFor(r.id, date);
  const sl = R.slotsFor({ restaurant: r, specials, date, party, covers });
  res.set('Cache-Control', 'no-store').json({ date, party, state: sl.state, note: sl.note || '', groups: sl.groups.map(g => ({ meal: g.meal, slots: g.slots.map(s => ({ time: s.time, full: s.full })) })) });
}

async function book(req, res) {
  const r = req.restaurant;
  const body = req.body || {};
  // Bots fill the hidden "website" field or submit instantly. Answer as if it worked, store nothing.
  if ((body.website && String(body.website).trim()) || (body.elapsed != null && Number(body.elapsed) < 2500)) {
    return res.json({ ok: true, ref: refCode(r.short_code), date: body.date, time: body.time, party: body.party, email: body.email });
  }
  const out = await createBooking({ restaurant: r, input: body, mode: 'public', ip: req.clientIp, source: req.viaKey ? 'web' : 'hosted' });
  if (out.errors) return res.status(422).json({ ok: false, errors: out.errors, phoneFmt: R.fmtPhone(r.phone) });
  const b = out.booking;
  await store.audit(req, 'booking_created_web', `${b.name} · ${r.name} · ${b.ref}`, { actor: 'guest', userId: null });
  res.status(201).json({ ok: true, ref: b.ref, date: b.date, time: R.hm(b.time_min), party: b.party, email: b.email, name: b.name });
}

router.post('/info', resolveRestaurant, readLimit, info);
router.post('/availability', resolveRestaurant, readLimit, availability);
router.post('/book', resolveRestaurant, bookLimit, book);
router.post('/r/:slug/info', resolveRestaurant, readLimit, info);
router.post('/r/:slug/availability', resolveRestaurant, readLimit, availability);
router.post('/r/:slug/book', resolveRestaurant, bookLimit, book);

module.exports = router;
