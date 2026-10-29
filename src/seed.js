'use strict';
// First start only: create the owner account from ADMIN_EMAIL / ADMIN_PASSWORD, and the two existing restaurants.
const config = require('./config');
const log = require('./lib/logger');
const { db } = require('./db');
const { hashPassword } = require('./lib/auth');
const { randomToken, sha256 } = require('./lib/crypto');
const { DEFAULT_RULES } = require('./lib/rules');

const RESTAURANTS = [
  {
    slug: 'mandoline', name: 'Mandoline', short_code: 'MD', domain: 'mandolinerestaurant.com.au', timezone: 'Australia/Melbourne',
    phone: '0395327353', email: 'bookings@mandolinerestaurant.com.au', address: '432 Glen Huntly Rd, Elsternwick VIC 3185', color: '#24305a',
    extra_note: 'Dinner is served Wednesday to Saturday from 6 pm. We hold tables for 15 minutes.',
    week: ['08:00-17:00', '08:00-17:00', '08:00-17:00', '08:00-17:00, 18:00-21:00', '08:00-17:00, 18:00-21:00', '08:00-17:00, 18:00-21:00', '08:00-17:00, 18:00-21:00'],
    rules: { ...DEFAULT_RULES, maxParty: 10, cap: 40 },
  },
  {
    slug: 'touchstone-cafe', name: 'Touchstone Cafe', short_code: 'TS', domain: 'touchstonecafe.au', timezone: 'Australia/Melbourne',
    phone: '0397589287', email: 'hello@touchstonecafe.com.au', address: '1/30 Aberdeen Rd, Macleod VIC 3085', color: '#4d6a4a',
    extra_note: 'High chairs available – just let us know.',
    week: Array(7).fill('08:30-15:00'),
    rules: { ...DEFAULT_RULES, lead: 60, maxDays: 45, maxParty: 8, cap: 30 },
  },
];

async function seedFirstRun() {
  const k = db();
  const [{ c: users }] = await k('users').count({ c: '*' });
  const [{ c: rests }] = await k('restaurants').count({ c: '*' });
  if (Number(users) > 0) return;
  if (Number(rests) === 0) {
    const t = Date.now();
    for (const r of RESTAURANTS) {
      const key = 'st_' + randomToken(30);
      const { week, rules, ...row } = r;
      await k('restaurants').insert({ ...row, week_hours: JSON.stringify(week), rules: JSON.stringify(rules), online: true, api_key_hash: sha256(key), api_key_prefix: key.slice(0, 10), created_at: t, updated_at: t });
    }
    log.info('Seeded restaurants: Mandoline, Touchstone Cafe');
  }
  if (config.admin.email && config.admin.password) {
    if (config.admin.password.length < 10) { log.warn('ADMIN_PASSWORD must be at least 10 characters; owner account not created.'); return; }
    await k('users').insert({ name: config.admin.name, email: config.admin.email, password_hash: await hashPassword(config.admin.password), role: 'owner', lang: 'vi', active: true, created_at: Date.now() });
    log.info(`Owner account created: ${config.admin.email}. Remove ADMIN_PASSWORD from the environment now.`);
  } else {
    log.warn('No accounts yet. Set ADMIN_EMAIL and ADMIN_PASSWORD, then restart, to create the owner account.');
  }
}

module.exports = { seedFirstRun, RESTAURANTS };
