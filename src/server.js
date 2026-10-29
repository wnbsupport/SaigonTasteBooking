'use strict';
// Start-up order for SiteGround: listen on the port first (so the proxy never sees a dead app),
// then connect to MySQL and run migrations in the background, retrying with back-off.
const config = require('./config');
const status = require('./status');
const log = require('./lib/logger');
const { db, migrate } = require('./db');
const { createApp } = require('./app');
const { seedFirstRun } = require('./seed');
const jobs = require('./lib/jobs');

process.on('uncaughtException', e => log.error('uncaughtException', e));
process.on('unhandledRejection', e => log.error('unhandledRejection', e));

async function setupDatabase() {
  status.attempts++;
  try {
    await db().raw('select 1');
    status.migrations = await migrate();
    await seedFirstRun();
    status.setReady();
    log.info('Database ready');
    if (config.jobs) jobs.start();
  } catch (e) {
    status.setError(e);
    const wait = Math.min(60000, 2000 * 2 ** Math.min(status.attempts, 5));
    log.error(`Database setup failed (attempt ${status.attempts}), retrying in ${wait / 1000}s:`, status.error);
    setTimeout(setupDatabase, wait);
  }
}

const app = createApp();
const server = app.listen(config.port, () => {
  log.info(`Saigon Taste Booking listening on port ${config.port} (${config.appUrl})`);
  setupDatabase();
});
server.keepAliveTimeout = 65000;

module.exports = server;
