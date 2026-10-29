'use strict';
// Sign-in sessions (cookie → sessions table), idle sign-out, lockout after wrong passwords, and role checks.
const bcrypt = require('bcryptjs');
const config = require('../config');
const { db } = require('../db');
const { randomToken, sha256 } = require('./crypto');
const { getSetting, restaurantIdsFor } = require('./store');

const COOKIE = 'st_sid';
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const SESSION_DAYS = 30;
const DEFAULT_IDLE = 30;
const IDLE_CHOICES = [15, 30, 60, 240, 720];

let idleCache = { at: 0, v: DEFAULT_IDLE };
async function idleMinutes() {
  if (Date.now() - idleCache.at < 30000) return idleCache.v;
  const v = await getSetting('idle_minutes', DEFAULT_IDLE);
  idleCache = { at: Date.now(), v: IDLE_CHOICES.includes(v) ? v : DEFAULT_IDLE };
  return idleCache.v;
}
function clearIdleCache() { idleCache.at = 0; }

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

async function createSession(req, res, user) {
  const token = randomToken(32);
  const t = Date.now();
  await db()('sessions').insert({ id: sha256(token), user_id: user.id, created_at: t, last_seen_at: t, ip: String(req.ip || '').slice(0, 64), user_agent: String(req.get('user-agent') || '').slice(0, 255) });
  res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: SESSION_DAYS * 864e5 });
}
async function destroySession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) await db()('sessions').where({ id: sha256(token) }).del();
  res.clearCookie(COOKIE, cookieOpts());
}

/** Attach req.user if the cookie is valid. Background polling (X-Background: 1) does not count as activity. */
async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (!token) return next();
  const id = sha256(token);
  const s = await db()('sessions').where({ id }).first();
  if (!s) { res.clearCookie(COOKIE, cookieOpts()); return next(); }
  const t = Date.now();
  const idle = await idleMinutes();
  if (t - Number(s.last_seen_at) > idle * 60000 || t - Number(s.created_at) > SESSION_DAYS * 864e5) {
    await db()('sessions').where({ id }).del();
    res.clearCookie(COOKIE, cookieOpts());
    req.sessionEnded = 'idle';
    return next();
  }
  const user = await db()('users').where({ id: s.user_id }).first();
  if (!user || !user.active) { await db()('sessions').where({ id }).del(); res.clearCookie(COOKIE, cookieOpts()); return next(); }
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, lang: user.lang };
  req.user.restaurantIds = await restaurantIdsFor(req.user);
  req.sessionId = id;
  if (req.get('x-background') !== '1' && t - Number(s.last_seen_at) > 20000) {
    await db()('sessions').where({ id }).update({ last_seen_at: t });
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

module.exports = { COOKIE, MAX_FAILS, LOCK_MIN, IDLE_CHOICES, DEFAULT_IDLE, idleMinutes, clearIdleCache, hashPassword, checkPassword, passwordProblem, createSession, destroySession, loadUser, requireAuth, requireOwner, sameOrigin, readCookie };
