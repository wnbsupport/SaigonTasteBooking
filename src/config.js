'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env;
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));

const appUrl = (env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

module.exports = {
  root: path.join(__dirname, '..'),
  env: env.NODE_ENV || 'production',
  port: int(env.PORT, 3000),
  appUrl,
  secureCookies: appUrl.startsWith('https://'),
  db: {
    client: env.DB_CLIENT || (env.DB_NAME ? 'mysql2' : 'better-sqlite3'),
    host: env.DB_HOST || 'localhost',
    port: int(env.DB_PORT, 3306),
    name: env.DB_NAME || '',
    user: env.DB_USER || '',
    password: env.DB_PASSWORD || '',
    file: env.DB_FILE || path.join(__dirname, '..', 'dev.sqlite'),
  },
  admin: { email: (env.ADMIN_EMAIL || '').trim().toLowerCase(), password: env.ADMIN_PASSWORD || '', name: env.ADMIN_NAME || 'Chủ Saigon Taste' },
  // System mailbox: password resets, invites, sign-in alerts, and fallback when a restaurant's own mailbox fails.
  smtp: {
    host: env.SMTP_HOST || '',
    port: int(env.SMTP_PORT, 465),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || env.SMTP_USER || '',
    fromName: env.MAIL_FROM_NAME || 'Saigon Taste Booking',
  },
  encryptionKey: env.ENCRYPTION_KEY || '',
  jobs: bool(env.JOBS, true),
  deployCleanup: bool(env.DEPLOY_CLEANUP, true),
};
