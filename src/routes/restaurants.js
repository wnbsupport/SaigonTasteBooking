'use strict';
// Restaurants: details, booking hours and rules, website key, and each restaurant's own mailbox.
const express = require('express');
const { db } = require('../db');
const R = require('../lib/rules');
const store = require('../lib/store');
const { randomToken, sha256, encrypt, hasKey } = require('../lib/crypto');
const mailer = require('../lib/mailer');
const { requireAuth, requireOwner } = require('../lib/auth');

const router = express.Router();
router.use(requireAuth);

const COLORS = ['#24305a', '#4d6a4a', '#b0442c', '#7a4f9a', '#1f6f8b', '#a6782a', '#c2416b', '#3f3f46'];

function full(r, specials) {
  return {
    id: r.id, slug: r.slug, name: r.name, short: r.short_code, domain: r.domain, timezone: r.timezone, phone: r.phone, phoneFmt: R.fmtPhone(r.phone),
    email: r.email, address: r.address, color: r.color, extraNote: r.extra_note || '', privacyUrl: r.privacy_url, week: r.week_hours, rules: r.rules,
    online: r.online, keyPrefix: r.api_key_prefix, specials: specials.map(s => ({ date: s.date, hours: s.hours, note: s.note })),
    mail: { fromName: r.mail_from_name, host: r.smtp_host, port: r.smtp_port, user: r.smtp_user, passSet: !!r.smtp_pass_enc, status: r.mail_status, error: r.mail_error, checkedAt: r.mail_checked_at ? Number(r.mail_checked_at) : null },
  };
}

router.get('/', async (req, res) => {
  const rs = (await store.listRestaurants()).filter(r => req.user.restaurantIds.includes(r.id));
  if (req.user.role !== 'owner') return res.json({ restaurants: rs.map(r => ({ id: r.id, name: r.name, color: r.color, timezone: r.timezone, phone: r.phone, online: r.online, slug: r.slug })) });
  const out = [];
  for (const r of rs) out.push(full(r, await store.specialsFor(r.id)));
  res.json({ restaurants: out, colors: COLORS, timezones: R.TIMEZONES, encryption: hasKey(), systemMail: mailer.systemReady() });
});

function newKey() { const key = 'st_' + randomToken(30); return { key, hash: sha256(key), prefix: key.slice(0, 10) }; }
function slugify(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'restaurant'; }
const cleanDomain = s => R.clean(s, 190).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

/** Check and normalise everything the settings form sends. Returns { errors, patch, specials }. */
function readForm(body, current) {
  const e = {}, p = {};
  if (body.name !== undefined) { p.name = R.clean(body.name, 120); if (p.name.length < 2) e.name = 'required'; }
  if (body.domain !== undefined) p.domain = cleanDomain(body.domain);
  if (body.timezone !== undefined) { if (!R.TIMEZONES.includes(body.timezone)) e.timezone = 'invalid'; else p.timezone = body.timezone; }
  if (body.phone !== undefined) { const ph = R.normPhone(body.phone); if (!ph) e.phone = 'invalid'; else p.phone = ph; }
  if (body.email !== undefined) { p.email = R.clean(body.email, 190).toLowerCase(); if (!R.emailOk(p.email)) e.email = 'invalid'; }
  if (body.address !== undefined) p.address = R.clean(body.address, 255);
  if (body.extraNote !== undefined) p.extra_note = String(body.extraNote || '').replace(/\r/g, '').slice(0, 600).trim();
  if (body.privacyUrl !== undefined) { p.privacy_url = R.clean(body.privacyUrl, 255); if (p.privacy_url && !/^https:\/\//.test(p.privacy_url)) e.privacyUrl = 'invalid'; }
  if (body.color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(body.color)) e.color = 'invalid'; else p.color = body.color; }
  if (body.online !== undefined) p.online = !!body.online;
  if (body.week !== undefined) {
    if (!Array.isArray(body.week) || body.week.length !== 7) e.week = 'invalid';
    else {
      const w = body.week.map(x => R.clean(x, 120));
      const bad = w.map((x, i) => (R.parseSessions(x) ? null : i)).filter(x => x != null);
      if (bad.length) e.week = bad; else p.week_hours = JSON.stringify(w.map(x => R.formatSessions(R.parseSessions(x))));
    }
  }
  if (body.rules !== undefined) p.rules = JSON.stringify(R.normalizeRules(body.rules, current ? current.rules : undefined));
  let specials;
  if (body.specials !== undefined) {
    if (!Array.isArray(body.specials) || body.specials.length > 100) e.specials = 'invalid';
    else {
      const seen = new Set();
      specials = [];
      body.specials.forEach((s, i) => {
        const date = String(s.date || ''), sess = R.parseSessions(s.hours);
        if (!R.isDate(date) || !sess || seen.has(date)) { (e.specials = e.specials || []).push(i); return; }
        seen.add(date);
        specials.push({ date, hours: R.formatSessions(sess), note: R.clean(s.note, 120) });
      });
    }
  }
  if (body.mail !== undefined && body.mail) {
    const m = body.mail;
    if (m.fromName !== undefined) p.mail_from_name = R.clean(m.fromName, 120);
    if (m.host !== undefined) { p.smtp_host = R.clean(m.host, 190).toLowerCase(); if (p.smtp_host && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(p.smtp_host)) e.mailHost = 'invalid'; }
    if (m.port !== undefined) { const port = parseInt(m.port, 10); if (![465, 587].includes(port)) e.mailPort = 'invalid'; else p.smtp_port = port; }
    if (m.user !== undefined) { p.smtp_user = R.clean(m.user, 190).toLowerCase(); if (p.smtp_user && !R.emailOk(p.smtp_user)) e.mailUser = 'invalid'; }
    if (m.clearPass) p.smtp_pass_enc = null;
    else if (m.pass) {
      if (!hasKey()) e.mailPass = 'no_key';
      else p.smtp_pass_enc = encrypt(String(m.pass).slice(0, 200));
    }
    if (['smtp_host', 'smtp_user', 'smtp_pass_enc', 'smtp_port'].some(x => x in p)) { p.mail_status = 'none'; p.mail_error = ''; }
  }
  return { errors: e, patch: p, specials };
}

async function saveSpecials(trx, id, specials) {
  if (!specials) return;
  await trx('special_dates').where({ restaurant_id: id }).del();
  if (specials.length) await trx('special_dates').insert(specials.map(s => ({ ...s, restaurant_id: id })));
}

router.post('/', requireOwner, async (req, res) => {
  const body = { week: Array(7).fill('11:00-15:00, 17:00-21:00'), rules: {}, ...req.body };
  const { errors, patch, specials } = readForm(body, null);
  for (const f of ['name', 'phone', 'email']) if (!patch[f] && !errors[f]) errors[f] = 'required';
  if (Object.keys(errors).length) return res.status(422).json({ errors });
  const k = db();
  let slug = slugify(patch.name), n = 1;
  while (await k('restaurants').where({ slug }).first()) slug = `${slugify(patch.name)}-${++n}`;
  let short = patch.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'RS';
  const count = (await k('restaurants').count({ c: '*' }))[0].c;
  const key = newKey();
  const t = Date.now();
  const id = await k.transaction(async trx => {
    const [rid] = await trx('restaurants').insert({
      timezone: 'Australia/Melbourne', color: COLORS[Number(count) % COLORS.length], domain: '', address: '', extra_note: '', ...patch, slug, short_code: short,
      api_key_hash: key.hash, api_key_prefix: key.prefix, created_at: t, updated_at: t,
    });
    await saveSpecials(trx, rid, specials);
    return rid;
  });
  await store.audit(req, 'restaurant_created', patch.name);
  const r = await store.getRestaurant(id);
  res.status(201).json({ restaurant: full(r, await store.specialsFor(id)), key: key.key });
});

router.put('/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const cur = await store.getRestaurant(id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const { errors, patch, specials } = readForm(req.body, cur);
  if (Object.keys(errors).length) return res.status(422).json({ errors });
  patch.updated_at = Date.now();
  await db().transaction(async trx => {
    await trx('restaurants').where({ id }).update(patch);
    await saveSpecials(trx, id, specials);
    // A new time zone moves the real start time of future bookings
    if (patch.timezone && patch.timezone !== cur.timezone) {
      const future = await trx('bookings').where({ restaurant_id: id }).where('starts_at', '>', Date.now() - 864e5);
      for (const b of future) await trx('bookings').where({ id: b.id }).update({ starts_at: R.startsAt(patch.timezone, b.date, b.time_min) });
    }
  });
  const changed = Object.keys(patch).filter(x => x !== 'updated_at').map(x => (x === 'smtp_pass_enc' ? 'smtp_pass' : x));
  if (specials) changed.push('special_dates');
  await store.audit(req, 'restaurant_updated', `${patch.name || cur.name} · ${changed.join(', ')}`);
  const r = await store.getRestaurant(id);
  res.json({ restaurant: full(r, await store.specialsFor(id)) });
});

router.post('/:id/key', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const cur = await store.getRestaurant(id);
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const key = newKey();
  await db()('restaurants').where({ id }).update({ api_key_hash: key.hash, api_key_prefix: key.prefix, updated_at: Date.now() });
  await store.audit(req, 'key_rotated', cur.name);
  res.json({ key: key.key, keyPrefix: key.prefix });
});

router.post('/:id/mail-test', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const r = await store.getRestaurant(id);
  if (!r) return res.status(404).json({ error: 'not_found' });
  const to = R.clean(req.body.to || req.user.email, 190);
  if (!R.emailOk(to)) return res.status(422).json({ errors: { to: 'invalid' } });
  const out = await mailer.testRestaurant(r, to);
  await store.audit(req, 'mail_test', `${r.name} → ${to} · ${out.ok ? 'OK' : out.error}`);
  res.json(out);
});

module.exports = router;
