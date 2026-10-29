'use strict';
// Small data-access helpers shared by routes and jobs.
const { db } = require('../db');
const { normalizeRules } = require('./rules');

const now = () => Date.now();

function parseRestaurant(row) {
  if (!row) return null;
  let week = [], rules = {};
  try { week = JSON.parse(row.week_hours || '[]'); } catch { week = []; }
  try { rules = JSON.parse(row.rules || '{}'); } catch { rules = {}; }
  while (week.length < 7) week.push('');
  return { ...row, week_hours: week.slice(0, 7), rules: normalizeRules(rules), online: !!row.online };
}

async function getRestaurant(id, k = db()) { return parseRestaurant(await k('restaurants').where({ id }).first()); }
async function getRestaurantBy(where, k = db()) { return parseRestaurant(await k('restaurants').where(where).first()); }
async function listRestaurants(k = db()) { return (await k('restaurants').orderBy('id')).map(parseRestaurant); }
async function specialsFor(restaurantId, k = db()) { return k('special_dates').where({ restaurant_id: restaurantId }).orderBy('date'); }

/** Guests already booked per time slot on a date (active bookings only). */
async function coversFor(restaurantId, date, ignoreId = null, k = db()) {
  let q = k('bookings').where({ restaurant_id: restaurantId, date }).whereIn('status', ['pending', 'confirmed', 'seated'])
    .select('time_min').sum({ guests: 'party' }).groupBy('time_min');
  if (ignoreId) q = q.whereNot({ id: ignoreId });
  const rows = await q;
  return new Map(rows.map(r => [Number(r.time_min), Number(r.guests) || 0]));
}

const actorName = req => (req && req.user ? req.user.name : 'system');
const clientIp = req => (req ? String(req.clientIp || req.ip || '').slice(0, 64) : '');

async function audit(req, action, detail = '', extra = {}) {
  await db()('audit_log').insert({
    at: now(), user_id: extra.userId !== undefined ? extra.userId : (req && req.user ? req.user.id : null),
    actor: String(extra.actor || actorName(req)).slice(0, 190), action, detail: String(detail || '').slice(0, 500), ip: clientIp(req),
  });
}

async function event(bookingId, actor, kind, detail = '', k = db()) {
  await k('booking_events').insert({ booking_id: bookingId, at: now(), actor: String(actor).slice(0, 190), kind, detail: String(detail || '').slice(0, 500) });
}

async function getSetting(key, def) {
  const row = await db()('settings').where({ key }).first();
  if (!row) return def;
  try { return JSON.parse(row.value); } catch { return def; }
}
async function setSetting(key, value) {
  const v = JSON.stringify(value);
  const k = db();
  const n = await k('settings').where({ key }).update({ value: v });
  if (!n) await k('settings').insert({ key, value: v });
}

/** Restaurants a user may see: owners see all, staff see the ones assigned. */
async function restaurantIdsFor(user) {
  if (!user) return [];
  if (user.role === 'owner') return (await db()('restaurants').select('id')).map(r => r.id);
  return (await db()('user_restaurants').where({ user_id: user.id }).select('restaurant_id')).map(r => r.restaurant_id);
}

module.exports = { now, parseRestaurant, getRestaurant, getRestaurantBy, listRestaurants, specialsFor, coversFor, audit, event, getSetting, setSetting, restaurantIdsFor, clientIp };
