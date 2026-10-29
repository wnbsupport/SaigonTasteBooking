'use strict';
// Owner-only: user accounts, security settings, activity log, server status.
const express = require('express');
const config = require('../config');
const { db } = require('../db');
const R = require('../lib/rules');
const store = require('../lib/store');
const A = require('../lib/auth');
const mailer = require('../lib/mailer');
const { hasKey } = require('../lib/crypto');
const { sendLink } = require('./auth');
const deploys = require('../lib/deploys');
const status = require('../status');
const pkg = require('../../package.json');

const router = express.Router();
router.use(A.requireOwner);

async function userList() {
  const users = await db()('users').orderBy('role', 'asc').orderBy('name');
  const links = await db()('user_restaurants');
  const t = Date.now();
  const devices = Object.fromEntries((await db()('sessions').select('user_id').count({ n: '*' }).groupBy('user_id')).map(r => [r.user_id, Number(r.n)]));
  return users.map(u => ({
    id: u.id, name: u.name, email: u.email, role: u.role, lang: u.lang, active: !!u.active, hasPassword: !!u.password_hash,
    locked: !!(u.locked_until && Number(u.locked_until) > t), lastLoginAt: u.last_login_at ? Number(u.last_login_at) : null,
    restaurantIds: links.filter(l => l.user_id === u.id).map(l => l.restaurant_id), devices: devices[u.id] || 0,
  }));
}

router.get('/users', async (req, res) => res.json({ users: await userList() }));

async function readUser(body, isNew) {
  const e = {}, p = {};
  if (isNew || body.name !== undefined) { p.name = R.clean(body.name, 120); if (p.name.length < 2) e.name = 'required'; }
  if (isNew) { p.email = R.clean(body.email, 190).toLowerCase(); if (!R.emailOk(p.email)) e.email = 'invalid'; else if (await db()('users').where({ email: p.email }).first()) e.email = 'exists'; }
  if (isNew || body.role !== undefined) p.role = body.role === 'owner' ? 'owner' : 'staff';
  if (isNew || body.lang !== undefined) p.lang = body.lang === 'en' ? 'en' : 'vi';
  if (body.active !== undefined) p.active = !!body.active;
  let rids;
  if (body.restaurantIds !== undefined) {
    const all = (await db()('restaurants').select('id')).map(r => r.id);
    rids = (Array.isArray(body.restaurantIds) ? body.restaurantIds : []).map(Number).filter(x => all.includes(x));
  }
  if ((p.role || 'staff') === 'staff' && isNew && (!rids || !rids.length)) e.restaurantIds = 'required';
  return { errors: e, patch: p, rids };
}

router.post('/users', async (req, res) => {
  const { errors, patch, rids } = await readUser(req.body, true);
  if (Object.keys(errors).length) return res.status(422).json({ errors });
  const [id] = await db()('users').insert({ ...patch, active: true, created_at: Date.now() });
  if (rids && rids.length) await db()('user_restaurants').insert(rids.map(r => ({ user_id: id, restaurant_id: r })));
  const user = await db()('users').where({ id }).first();
  const link = await sendLink(user, 'invite');
  await store.audit(req, 'user_invited', `${user.name} · ${user.email} · ${user.role}`);
  res.status(201).json({ users: await userList(), link });
});

router.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const cur = await db()('users').where({ id }).first();
  if (!cur) return res.status(404).json({ error: 'not_found' });
  const { errors, patch, rids } = await readUser(req.body, false);
  if (id === req.user.id && (patch.active === false || patch.role === 'staff')) errors.self = 'self';
  if (cur.role === 'owner' && (patch.role === 'staff' || patch.active === false)) {
    const [{ c }] = await db()('users').where({ role: 'owner', active: true }).whereNot({ id }).count({ c: '*' });
    if (Number(c) < 1) errors.lastOwner = 'last';
  }
  if (Object.keys(errors).length) return res.status(422).json({ errors });
  await db().transaction(async trx => {
    if (Object.keys(patch).length) await trx('users').where({ id }).update(patch);
    if (rids) { await trx('user_restaurants').where({ user_id: id }).del(); if (rids.length) await trx('user_restaurants').insert(rids.map(r => ({ user_id: id, restaurant_id: r }))); }
    if (patch.active === false) await trx('sessions').where({ user_id: id }).del();
  });
  await store.audit(req, 'user_updated', `${cur.name} · ${Object.keys(patch).concat(rids ? ['restaurants'] : []).join(', ')}`);
  res.json({ users: await userList() });
});

router.post('/users/:id/link', async (req, res) => {
  const user = await db()('users').where({ id: Number(req.params.id), active: true }).first();
  if (!user) return res.status(404).json({ error: 'not_found' });
  const link = await sendLink(user, user.password_hash ? 'reset' : 'invite');
  await store.audit(req, 'user_link', user.email);
  res.json({ link });
});

/** Sign a user out on all their devices. */
router.post('/users/:id/logout-all', async (req, res) => {
  const user = await db()('users').where({ id: Number(req.params.id) }).first();
  if (!user) return res.status(404).json({ error: 'not_found' });
  const n = await db()('sessions').where({ user_id: user.id }).del();
  await store.audit(req, 'user_logout_all', `${user.email} · ${n}`);
  res.json({ users: await userList(), self: user.id === req.user.id });
});

router.post('/users/:id/unlock', async (req, res) => {
  const user = await db()('users').where({ id: Number(req.params.id) }).first();
  if (!user) return res.status(404).json({ error: 'not_found' });
  await db()('users').where({ id: user.id }).update({ locked_until: null, failed_logins: 0 });
  await store.audit(req, 'user_unlocked', user.email);
  res.json({ users: await userList() });
});

router.get('/settings', async (req, res) => {
  res.json({ deployCleanup: await store.getSetting('deploy_cleanup', true) });
});
router.put('/settings', async (req, res) => {
  const changes = [];
  if (req.body.deployCleanup !== undefined) { await store.setSetting('deploy_cleanup', !!req.body.deployCleanup); changes.push(`deploy cleanup ${req.body.deployCleanup ? 'on' : 'off'}`); }
  await store.audit(req, 'settings_updated', changes.join(', '));
  res.json({ deployCleanup: await store.getSetting('deploy_cleanup', true) });
});

const SECURITY = ['login', 'login_failed', 'login_locked', 'logout', 'logout_all', 'user_logout_all', 'auto_logout', 'password_reset_request', 'password_set', 'password_changed', 'user_invited', 'user_updated', 'user_link', 'user_unlocked', 'settings_updated', 'key_rotated'];
router.get('/audit', async (req, res) => {
  let q = db()('audit_log').orderBy('id', 'desc').limit(100);
  if (req.query.filter === 'security') q = q.whereIn('action', SECURITY);
  else if (req.query.filter === 'bookings') q = q.whereNotIn('action', SECURITY);
  const before = parseInt(req.query.before, 10);
  if (before) q = q.where('id', '<', before);
  const rows = await q;
  res.json({ entries: rows.map(r => ({ id: r.id, at: Number(r.at), actor: r.actor, action: r.action, detail: r.detail, ip: r.ip })), more: rows.length === 100 });
});

router.get('/system', async (req, res) => {
  const [{ c: failed }] = await db()('emails').where({ status: 'failed' }).where('created_at', '>', Date.now() - 7 * 864e5).count({ c: '*' });
  res.json({
    version: pkg.version, database: status.state, appUrl: config.appUrl, encryption: hasKey(), systemMail: mailer.systemReady(),
    systemMailFrom: config.smtp.from, failedEmails7d: Number(failed), deploys: deploys.lastResult(), deployCleanup: await store.getSetting('deploy_cleanup', true),
    adminPasswordInEnv: !!config.admin.password,
  });
});

module.exports = router;
