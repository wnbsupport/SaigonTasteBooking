'use strict';
// Booking rules: opening hours per restaurant, time slots, and checks on what a guest sends.
// Every check here runs on the server for every request, whatever the form sent.
const { DateTime } = require('luxon');

// cap = most guests in the restaurant at the same time (0 = no limit). stay / stayEvening = how long a table is
// usually occupied for bookings before / from 17:00, used to count who is still seated at a given time.
const DEFAULT_RULES = { interval: 30, lastBefore: 60, lead: 120, maxDays: 60, maxParty: 10, cap: 0, remind: 30, stay: 60, stayEvening: 90 };
const EVENING = 17 * 60;
const RULE_LIMITS = {
  interval: [15, 30], lastBefore: [0, 180], lead: [0, 2880], maxDays: [1, 365], maxParty: [1, 50], cap: [0, 1000], remind: [0, 1440], stay: [15, 300], stayEvening: [15, 300],
};
const ACTIVE = ['pending', 'confirmed', 'seated'];
const TIMEZONES = ['Australia/Melbourne', 'Australia/Sydney', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin'];

const pad = n => String(n).padStart(2, '0');
const hm = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && DateTime.fromISO(s).isValid;
const toMin = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); if (!m) return null; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? h * 60 + mi : null; };

/** "08:00-17:00, 18:00-21:00" → [[480,1020],[1080,1260]]; "" → []; invalid → null */
function parseSessions(str) {
  const s = String(str == null ? '' : str).trim();
  if (!s) return [];
  const out = [];
  for (const part of s.split(',')) {
    const m = part.trim().match(/^(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})$/);
    if (!m) return null;
    if (+m[2] > 59 || +m[4] > 59) return null;
    const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4];
    if (b <= a || b > 1440) return null;
    out.push([a, b]);
  }
  out.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < out.length; i++) if (out[i][0] < out[i - 1][1]) return null;
  return out;
}
const formatSessions = arr => arr.map(([a, b]) => hm(a) + '-' + hm(b)).join(', ');

function normalizeRules(input, base = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...base };
  for (const k of Object.keys(RULE_LIMITS)) {
    if (input && input[k] != null && input[k] !== '') {
      const v = parseInt(input[k], 10);
      const [lo, hi] = RULE_LIMITS[k];
      if (Number.isFinite(v)) r[k] = Math.min(hi, Math.max(lo, v));
    }
  }
  if (![15, 30].includes(r.interval)) r.interval = 30;
  return r;
}

/** Australian phone numbers, stored as 10 digits starting with 0. */
function normPhone(s) {
  let d = String(s || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+61')) d = '0' + d.slice(3);
  else if (d.startsWith('61') && d.length === 11) d = '0' + d.slice(2);
  d = d.replace(/\D/g, '');
  if (d.length === 9 && /^[23478]/.test(d)) d = '0' + d;
  return /^0[23478]\d{8}$/.test(d) ? d : null;
}
const fmtPhone = d => !d ? '' : d.startsWith('04') ? `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)} ${d.slice(6)}`;
const emailOk = s => typeof s === 'string' && s.length <= 190 && /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(s.trim());
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\s+/g, m => (m.includes('\n') ? '\n' : ' ')).trim().slice(0, max);

/** Local wall-clock date+minute in the restaurant's time zone → epoch ms. */
function startsAt(tz, date, min) {
  return DateTime.fromISO(date, { zone: tz }).set({ hour: Math.floor(min / 60), minute: min % 60, second: 0, millisecond: 0 }).toMillis();
}
function today(tz, now = Date.now()) { return DateTime.fromMillis(now, { zone: tz }).toISODate(); }
function addDays(date, n) { return DateTime.fromISO(date, { zone: 'UTC' }).plus({ days: n }).toISODate(); }
function dayDiff(a, b) { return Math.round(DateTime.fromISO(b, { zone: 'UTC' }).diff(DateTime.fromISO(a, { zone: 'UTC' }), 'days').days); }
function weekday(date) { return DateTime.fromISO(date, { zone: 'UTC' }).weekday % 7; } // 0 = Sunday

/** Sessions open on a date: a special date replaces the weekly hours. */
function sessionsFor(restaurant, specials, date) {
  const sp = specials.find(x => x.date === date);
  const src = sp ? sp.hours : restaurant.week_hours[weekday(date)];
  return { sessions: parseSessions(src) || [], special: sp || null };
}

/** How long a booking starting at minute m keeps its table. */
const stayFor = (rules, m) => (m >= EVENING ? rules.stayEvening : rules.stay);

/** Guests seated at minute p. booked: [{ min, party }] (active bookings that day). */
function seatedAt(rules, booked, p) {
  let n = 0;
  for (const b of booked) if (b.min <= p && p < b.min + stayFor(rules, b.min)) n += b.party;
  return n;
}
/** Most guests seated at any moment while a new booking at minute m would be at the table. */
function peakDuring(rules, booked, m) {
  const end = m + stayFor(rules, m);
  let peak = seatedAt(rules, booked, m);
  for (const b of booked) if (b.min > m && b.min < end) peak = Math.max(peak, seatedAt(rules, booked, b.min));
  return peak;
}
/** Would `party` more guests at minute m go over the restaurant's limit? */
const overCap = (rules, booked, m, party) => rules.cap > 0 && peakDuring(rules, booked, m) + party > rules.cap;

const MEAL = m => (m < 11 * 60 ? 'breakfast' : m < 15 * 60 ? 'lunch' : m < 17 * 60 + 30 ? 'afternoon' : 'dinner');

/**
 * Available times for a date.
 * booked: [{ min, party }] active bookings that day; a slot is full when the guests already seated during the
 * new booking's stay plus this party would go over the limit.
 * Returns { state, note, groups:[{meal, slots:[{time, min, full}]}] }
 * state: ok | closed | none | past | toofar | paused
 */
function slotsFor({ restaurant, specials, date, party = 1, booked = [], now = Date.now() }) {
  const tz = restaurant.timezone, R = restaurant.rules;
  const t = today(tz, now);
  const dd = dayDiff(t, date);
  if (dd < 0) return { state: 'past', groups: [] };
  if (dd > R.maxDays) return { state: 'toofar', groups: [] };
  const sc = sessionsFor(restaurant, specials, date);
  if (!sc.sessions.length) return { state: 'closed', note: sc.special ? sc.special.note : '', groups: [] };
  if (!restaurant.online) return { state: 'paused', groups: [] };
  const groups = [];
  for (const [open, close] of sc.sessions) {
    for (let m = open; m <= close - R.lastBefore; m += R.interval) {
      if (startsAt(tz, date, m) - now < R.lead * 60000) continue;
      const full = overCap(R, booked, m, party);
      const meal = MEAL(m);
      let g = groups[groups.length - 1];
      if (!g || g.meal !== meal) groups.push(g = { meal, slots: [] });
      g.slots.push({ time: hm(m), min: m, full });
    }
  }
  if (!groups.length) return { state: 'none', groups: [] };
  return { state: 'ok', groups };
}

/** First date (from today) that has at least one bookable time, for the form's default. */
function firstOpenDate({ restaurant, specials, now = Date.now() }) {
  const t = today(restaurant.timezone, now);
  for (let i = 0; i <= Math.min(restaurant.rules.maxDays, 60); i++) {
    const d = addDays(t, i);
    if (slotsFor({ restaurant, specials, date: d, now }).state === 'ok') return d;
  }
  return t;
}

module.exports = {
  DEFAULT_RULES, RULE_LIMITS, ACTIVE, TIMEZONES, MEAL, stayFor, seatedAt, peakDuring, overCap,
  pad, hm, toMin, isDate, parseSessions, formatSessions, normalizeRules, normPhone, fmtPhone, emailOk, clean,
  startsAt, today, addDays, dayDiff, weekday, sessionsFor, slotsFor, firstOpenDate,
};
