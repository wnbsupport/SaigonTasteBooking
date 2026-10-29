'use strict';
const path = require('path');
const knexLib = require('knex');
const config = require('./config');
const log = require('./lib/logger');

function makeKnex(overrides = {}) {
  const c = { ...config.db, ...overrides };
  if (c.client === 'mysql2') {
    return knexLib({
      client: 'mysql2',
      connection: {
        host: c.host, port: c.port, user: c.user, password: c.password, database: c.name,
        charset: 'utf8mb4', timezone: 'Z', connectTimeout: 10000, dateStrings: false, supportBigNumbers: true, bigNumberStrings: false,
      },
      pool: { min: 0, max: 5 },
      acquireConnectionTimeout: 15000,
    });
  }
  return knexLib({
    client: 'better-sqlite3',
    connection: { filename: c.file },
    useNullAsDefault: true,
    pool: { afterCreate: (conn, done) => { conn.pragma('foreign_keys = ON'); done(); } },
  });
}

let knex = null;
function db() { if (!knex) knex = makeKnex(); return knex; }
function setDb(k) { knex = k; }
const isMysql = () => db().client.config.client === 'mysql2';

const migrationConfig = { directory: path.join(__dirname, '..', 'migrations'), tableName: 'knex_migrations', loadExtensions: ['.js'] };

// Run migrations only when some are pending; clear a lock left behind by a start that died mid-migration.
async function migrate(k = db()) {
  const [, pending] = await k.migrate.list(migrationConfig);
  if (!pending.length) return [];
  try {
    if (await k.schema.hasTable('knex_migrations_lock')) {
      const row = await k('knex_migrations_lock').first();
      if (row && row.is_locked) { log.warn('Releasing stale migration lock'); await k.migrate.forceFreeMigrationsLock(migrationConfig); }
    }
  } catch (e) { log.warn('Could not check migration lock:', e.message); }
  const [, done] = await k.migrate.latest(migrationConfig);
  log.info('Migrations run:', done.join(', '));
  return done;
}

module.exports = { db, setDb, makeKnex, migrate, isMysql, migrationConfig };
