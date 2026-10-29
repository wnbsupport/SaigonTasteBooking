'use strict';
// Sign in / out, forgotten password, invite links, and the signed-in user's own settings.
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const { db } = require('../db');
const A = require('../lib/auth');
const store = require('../lib/store');
const { randomToken, sha256 } = require('../lib/crypto');
const mailer = require('../lib/mailer');
const tpl = require('../lib/templates');
const R = require('../lib/rules');

const router = express.Router();
const limitMsg = { error: 'rate' };
const loginLimit = rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: limitMsg });
const forgotLimit = rateLimit({ windowMs: 60 * 60000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false, message: limitMsg });

async function mePayload(user) {
  const rs = await store.listRestaurants();
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, lang: user.lang },
    restaurants: rs.filter(r => user.restaurantIds.includes(r.id)).map(r => ({ id: r.id, name: r.name, color: r.color, timezone: r.timezone, short: r.short_code, online: r.online, slug: r.slug })),
  };
}

/** Create a single-use link for setting a password. kind: reset (1 hour) | invite (7 days) */
async function makeLink(userId, kind) {
  const token = randomToken(32);
  const t = Date.now();
  await db()('tokens').where({ user_id: userId, used_at: null }).update({ used_at: t }); // older links stop working
  await db()('tokens').insert({ user_id: userId, kind, token_hash: sha256(token), expires_at: t + (kind === 'invite' ? 7 * 864e5 : 3600e3), created_at: t });
  return `${config.appUrl}/password?token=${encodeURIComponent(token)}`;
}
async function sendLink(user, kind) {
  const link = await makeLink(user.id, kind);
  const m = tpl.userLink(kind, user.lang, user, link);
  await mailer.queue({ kind: 'user_' + kind, sender: 'system', to: user.email, subject: m.subject, html: m.html, text: m.text });
  return link;
}

router.post('/login', loginLimit, async (req, res) => {
  const email = R.clean(req.body.email, 190).toLowerCase();
  const pw = String(req.body.password || '');
  const k = db();
  const user = email ? await k('users').where({ email }).first() : null;
  const t = Date.now();
  if (user && user.locked_until && Number(user.locked_until) > t) {
    return res.status(423).json({ error: 'locked', minutes: Math.ceil((Number(user.locked_until) - t) / 60000) });
  }
  const ok = await A.checkPassword(pw, user && user.password_hash);
  if (!user || !ok || !user.active || !user.password_hash) {
    if (user) {
      const fails = (user.failed_logins || 0) + 1;
      if (fails >= A.MAX_FAILS) {
        await k('users').where({ id: user.id }).update({ failed_logins: 0, locked_until: t + A.LOCK_MIN * 60000 });
        await store.audit(req, 'login_locked', `${user.email} · ${A.MAX_FAILS}/${A.MAX_FAILS}`, { actor: user.email, userId: user.id });
        const owners = await k('users').where({ role: 'owner', active: true });
        for (const o of owners) {
          const m = tpl.lockAlert(o.lang, { email: user.email, n: A.MAX_FAILS, ip: req.ip, m: A.LOCK_MIN });
          await mailer.queue({ kind: 'lock_alert', sender: 'system', to: o.email, subject: m.subject, html: m.html, text: m.text });
        }
        return res.status(423).json({ error: 'locked', minutes: A.LOCK_MIN, justLocked: true });
      }
      await k('users').where({ id: user.id }).update({ failed_logins: fails });
      await store.audit(req, 'login_failed', `${user.email} · ${fails}/${A.MAX_FAILS}`, { actor: user.email, userId: user.id });
      return res.status(401).json({ error: 'invalid', left: fails >= 3 ? A.MAX_FAILS - fails : null });
    }
    await store.audit(req, 'login_failed', email ? `${email} · không có tài khoản` : '', { actor: email || '—', userId: null });
    return res.status(401).json({ error: 'invalid', left: null });
  }
  await k('users').where({ id: user.id }).update({ failed_logins: 0, locked_until: null, last_login_at: t });
  await A.createSession(req, res, user, req.body.remember !== false);
  const u = { id: user.id, name: user.name, email: user.email, role: user.role, lang: user.lang };
  u.restaurantIds = await store.restaurantIdsFor(u);
  req.user = u;
  await store.audit(req, 'login', '');
  res.json(await mePayload(u));
});

/** Sign this user out on every device (lost phone, shared iPad…). */
router.post('/logout-all', A.requireAuth, async (req, res) => {
  const n = await db()('sessions').where({ user_id: req.user.id }).del();
  await require('../lib/push').removeAllFor(req.user.id);
  await store.audit(req, 'logout_all', String(n));
  res.clearCookie(A.COOKIE, { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/' });
  res.json({ ok: true, sessions: n });
});

router.post('/logout', async (req, res) => {
  if (req.user) {
    if (req.body.endpoint) await require('../lib/push').removeSubscription(req.user.id, req.body.endpoint); // stop notifications on this device
    await store.audit(req, 'logout', '');
  }
  await A.destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'auth', reason: req.sessionEnded || 'none' });
  }
  res.json(await mePayload(req.user));
});

router.post('/forgot', forgotLimit, async (req, res) => {
  const email = R.clean(req.body.email, 190).toLowerCase();
  const user = email ? await db()('users').where({ email, active: true }).first() : null;
  if (user) {
    await sendLink(user, user.password_hash ? 'reset' : 'invite');
    await store.audit(req, 'password_reset_request', user.email, { actor: user.email, userId: user.id });
  }
  res.json({ ok: true }); // same answer either way, so nobody can probe which emails exist
});

async function findToken(token) {
  if (!token) return null;
  const row = await db()('tokens').where({ token_hash: sha256(token) }).first();
  if (!row || row.used_at || Number(row.expires_at) < Date.now()) return null;
  const user = await db()('users').where({ id: row.user_id, active: true }).first();
  return user ? { row, user } : null;
}

router.get('/token', async (req, res) => {
  const f = await findToken(String(req.query.token || ''));
  if (!f) return res.status(404).json({ error: 'token' });
  res.json({ kind: f.row.kind, name: f.user.name, email: f.user.email, lang: f.user.lang });
});

router.post('/password', forgotLimit, async (req, res) => {
  const f = await findToken(String(req.body.token || ''));
  if (!f) return res.status(404).json({ error: 'token' });
  const prob = A.passwordProblem(req.body.password);
  if (prob) return res.status(400).json({ error: 'password', reason: prob });
  const k = db();
  await k('users').where({ id: f.user.id }).update({ password_hash: await A.hashPassword(req.body.password), failed_logins: 0, locked_until: null, last_login_at: Date.now() });
  await k('tokens').where({ id: f.row.id }).update({ used_at: Date.now() });
  await k('sessions').where({ user_id: f.user.id }).del();
  await A.createSession(req, res, f.user);
  const u = { id: f.user.id, name: f.user.name, email: f.user.email, role: f.user.role, lang: f.user.lang };
  u.restaurantIds = await store.restaurantIdsFor(u);
  req.user = u;
  await store.audit(req, 'password_set', f.row.kind === 'invite' ? 'invite' : 'reset');
  res.json(await mePayload(u));
});

router.patch('/me', A.requireAuth, async (req, res) => {
  const lang = req.body.lang === 'en' ? 'en' : req.body.lang === 'vi' ? 'vi' : null;
  if (!lang) return res.status(400).json({ error: 'lang' });
  await db()('users').where({ id: req.user.id }).update({ lang });
  req.user.lang = lang;
  await store.audit(req, 'lang_changed', lang.toUpperCase());
  res.json(await mePayload(req.user));
});

router.post('/me/password', A.requireAuth, async (req, res) => {
  const user = await db()('users').where({ id: req.user.id }).first();
  if (!(await A.checkPassword(req.body.current, user.password_hash))) return res.status(400).json({ error: 'current' });
  const prob = A.passwordProblem(req.body.password);
  if (prob) return res.status(400).json({ error: 'password', reason: prob });
  await db()('users').where({ id: user.id }).update({ password_hash: await A.hashPassword(req.body.password) });
  await db()('sessions').where({ user_id: user.id }).whereNot({ id: req.sessionId }).del();
  await store.audit(req, 'password_changed', '');
  res.json({ ok: true });
});

module.exports = { router, sendLink, makeLink, mePayload };
