'use strict';
// Sign-in sessions (cookie → sessions table), "remember me", lockout after wrong passwords, and role checks.
const bcrypt = require('bcryptjs');
const config = require('../config');
const { db } = require('../db');
const { randomToken, sha256 } = require('./crypto');
const { restaurantIdsFor } = require('./store');

const COOKIE = 'st_sid';
const MAX_FAILS = 5;
const LOCK_MIN = 15;
// No automatic sign-out while the app is in use.
// "Remember me": the session lasts until the device has not used the app for 90 days (renewed on use).
// Not remembered: the cookie ends when the browser/app is closed; the server forgets it after 2 days unused.
const REMEMBER_DAYS = 90;
const SHORT_DAYS = 2;
const TOUCH_MS = 10 * 60000; // refresh last-seen (and the remember cookie) at most every 10 minutes

const hashPassword = pw => bcrypt.hash(pw, 10);
// A real hash for unknown accounts, so a wrong email takes as long as a wrong password (no account probing by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const checkPassword = (pw, hash) => bcrypt.compare(String(pw || ''), hash || DUMMY_HASH);
const passwordProblem = pw => (typeof pw !== 'string' || pw.length < 10 ? 'short' : pw.length > 200 ? 'long' : null);

function readCookie(req, name) {
  const h = req.headers.cookie || '';
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; } }
  }
  return null;
}
function cookieOpts() { return { httpOnly: true, secure: config.secureCookies, sameSite: 'lax', path: '/' }; }

function setCookie(res, token, remember) {
  res.cookie(COOKIE, token, remember ? { ...cookieOpts(), maxAge: REMEMBER_DAYS * 864e5 } : cookieOpts());
}
async function createSession(req, res, user, remember = true) {
  const token = randomToken(32);
  const t = Date.now();
  await db()('sessions').insert({ id: sha256(token), user_id: user.id, created_at: t, last_seen_at: t, remember: !!remember, ip: String(req.ip || '').slice(0, 64), user_agent: String(req.get('user-agent') || '').slice(0, 255) });
  setCookie(res, token, remember);
}
async function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await db()('sessions').where({ id: sha256(token) }).del();
  res.clearCookie(COOKIE, cookieOpts());
}
const sessionLimit = s => (s.remember ? REMEMBER_DAYS : SHORT_DAYS) * 864e5;

/** Attach req.user if the cookie is valid. Any request (including the app's background refresh) counts as use. */
async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return next();
  const id = sha256(token);
  const s = await db()('sessions').where({ id }).first();
  if (!s) { res.clearCookie(COOKIE, cookieOpts()); req.sessionEnded = 'ended'; return next(); }
  const t = Date.now();
  if (t - Number(s.last_seen_at) > sessionLimit(s)) {
    await db()('sessions').where({ id }).del();
    res.clearCookie(COOKIE, cookieOpts());
    req.sessionEnded = 'expired';
    return next();
  }
  const user = await db()('users').where({ id: s.user_id }).first();
  if (!user || !user.active) { await db()('sessions').where({ id }).del(); res.clearCookie(COOKIE, cookieOpts()); req.sessionEnded = 'ended'; return next(); }
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, lang: user.lang };
  req.user.restaurantIds = await restaurantIdsFor(req.user);
  req.sessionId = id;
  if (t - Number(s.last_seen_at) > TOUCH_MS) {
    await db()('sessions').where({ id }).update({ last_seen_at: t });
    if (s.remember) setCookie(res, token, true); // keep the 90 days rolling in the browser too
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth', reason: req.sessionEnded || 'none' });
  next();
}
function requireOwner(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'auth', reason: req.sessionEnded || 'none' });
  if (req.user.role !== 'owner') return res.status(403).json({ error: 'forbidden' });
  next();
}

/** State-changing API calls must come from this app's own pages. */
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const own = new Set([new URL(config.appUrl).origin, `${req.protocol}://${req.get('host')}`]);
  if (own.has(origin)) return next();
  return res.status(403).json({ error: 'origin' });
}

module.exports = { COOKIE, MAX_FAILS, LOCK_MIN, REMEMBER_DAYS, SHORT_DAYS, hashPassword, checkPassword, passwordProblem, createSession, destroySession, loadUser, requireAuth, requireOwner, sameOrigin, readCookie };
