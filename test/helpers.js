'use strict';
// Test setup: a fresh SQLite database per test file, the real Express app on a random port,
// and a fake mail transport that records what would be sent.
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stb-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_CLIENT: 'better-sqlite3', DB_FILE: path.join(dir, 'test.sqlite'), DB_NAME: '',
  APP_URL: 'http://localhost', ADMIN_EMAIL: 'owner@test.au', ADMIN_PASSWORD: 'owner-password-1', ENCRYPTION_KEY: 'test-encryption-key-1234567890',
  SMTP_HOST: 'smtp.system.test', SMTP_PORT: '465', SMTP_USER: 'bookings@saigontaste.test', SMTP_PASS: 'sys-pass', MAIL_FROM: 'bookings@saigontaste.test', JOBS: '0', DEPLOY_CLEANUP: '0',
});

// TEST_MYSQL=user:pass@host/db runs the same tests on MariaDB/MySQL (the database is wiped first).
const my = /^([^:]+):([^@]*)@([^/]+)\/(.+)$/.exec(process.env.TEST_MYSQL || '');
if (my) Object.assign(process.env, { DB_CLIENT: 'mysql2', DB_USER: my[1], DB_PASSWORD: my[2], DB_HOST: my[3], DB_NAME: my[4] });

const { db, migrate } = require('../src/db');
const { seedFirstRun } = require('../src/seed');
const status = require('../src/status');
const mailer = require('../src/lib/mailer');
const { createApp } = require('../src/app');

const sent = [];
const failHosts = new Set();
mailer.sync = true;
mailer.setFactory(opts => ({
  sendMail: async msg => {
    if (failHosts.has(opts.host)) throw Object.assign(new Error('Invalid login: 535 Authentication failed'), { code: 'EAUTH' });
    sent.push({ host: opts.host, user: opts.auth.user, ...msg });
    return { messageId: String(sent.length) };
  },
}));

let server, base;
async function start() {
  if (my) {
    await db().raw('SET FOREIGN_KEY_CHECKS = 0');
    for (const r of (await db().raw('SHOW TABLES'))[0]) await db().schema.dropTableIfExists(Object.values(r)[0]);
    await db().raw('SET FOREIGN_KEY_CHECKS = 1');
  }
  await migrate();
  await seedFirstRun();
  status.setReady();
  server = createApp().listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
  return base;
}
async function stop() {
  if (server) await new Promise(r => server.close(r));
  await db().destroy();
  fs.rmSync(dir, { recursive: true, force: true });
}

/** Tiny HTTP client that keeps a cookie, like a browser tab. */
function client() {
  let cookie = '';
  async function req(method, url, body, headers = {}) {
    const res = await fetch(base + url, {
      method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.get('set-cookie');
    if (sc) { const m = /st_sid=([^;]*)/.exec(sc); cookie = m && m[1] ? `st_sid=${m[1]}` : ''; }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, body: json, text, headers: res.headers };
  }
  return {
    get: (u, h) => req('GET', u, undefined, h), post: (u, b = {}, h) => req('POST', u, b, h), put: (u, b, h) => req('PUT', u, b, h), patch: (u, b, h) => req('PATCH', u, b, h),
    login: (email, password) => req('POST', '/api/auth/login', { email, password }),
    get cookie() { return cookie; },
  };
}

/** A date n days from today in Melbourne. */
function dayIn(n, tz = 'Australia/Melbourne') {
  const { DateTime } = require('luxon');
  return DateTime.now().setZone(tz).plus({ days: n }).toISODate();
}

module.exports = { start, stop, client, sent, failHosts, dayIn, db };
