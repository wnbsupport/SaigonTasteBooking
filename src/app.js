'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const status = require('./status');
const log = require('./lib/logger');
const A = require('./lib/auth');
const store = require('./lib/store');
const pkg = require('../package.json');

const PUBLIC = path.join(__dirname, '..', 'public');
const VERSION = pkg.version;

function page(file, vars = {}) {
  let html = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  vars = { v: VERSION, ...vars };
  return html.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}
const escAttr = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // SiteGround sits behind one proxy
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"], 'script-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:'], 'connect-src': ["'self'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"],
        'upgrade-insecure-requests': config.secureCookies ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.secureCookies,
  }));
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => { if (req.body == null || typeof req.body !== 'object') req.body = {}; next(); });

  // Health check: works even while the database is down, and says why in plain words.
  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store').status(status.state === 'error' ? 503 : 200).json({
      ok: status.state === 'ready', database: status.state === 'ready' ? 'ok' : status.state, error: status.error,
      version: VERSION, uptimeSeconds: Math.round(process.uptime()), migrationsRun: status.migrations,
    });
  });

  // Every other API call waits (up to 15 s) for the database instead of failing during start-up.
  app.use('/api', async (req, res, next) => {
    if (status.state === 'ready') return next();
    if (await status.waitReady(15000)) return next();
    res.status(503).json({ error: 'not_ready', message: 'Server is starting, please try again in a moment.' });
  });

  app.use('/api/public/v1', require('./routes/public'));

  app.use('/api', A.loadUser, A.sameOrigin, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/api/auth', require('./routes/auth').router);
  const bookings = require('./routes/bookings');
  app.use('/api/bookings', bookings.router);
  app.use('/api/emails', bookings.emails);
  app.use('/api/restaurants', require('./routes/restaurants'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // Service worker: the cache name carries the version, so each release replaces the old cache.
  app.get('/sw.js', (req, res) => {
    res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
    res.send(page('sw.js'));
  });

  // Hosted booking page for each restaurant: /book/<slug>
  app.get('/book/:slug', async (req, res, next) => {
    if (status.state !== 'ready' && !(await status.waitReady(15000))) return res.status(503).send('Starting, please refresh in a moment.');
    const r = await store.getRestaurantBy({ slug: String(req.params.slug).toLowerCase() });
    if (!r) return next();
    res.set('Cache-Control', 'no-cache').send(page('book.html', { name: escAttr(r.name), slug: escAttr(r.slug), color: escAttr(r.color), domain: escAttr(r.domain) }));
  });

  const spa = (req, res) => res.set('Cache-Control', 'no-cache').send(page('index.html'));
  app.get(['/', '/password', '/print'], spa);
  app.use(express.static(PUBLIC, { index: false, maxAge: '7d', setHeaders: (res, p) => { if (/\.(webmanifest|html)$/.test(p)) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.use((req, res) => res.status(404).type('text').send('Not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.code || 'bad_request', message: err.message });
    log.error(`${req.method} ${req.originalUrl}`, err);
    res.status(500).json({ error: 'server', message: 'Something went wrong on the server. Please try again.' });
  });
  return app;
}

module.exports = { createApp, VERSION };
