'use strict';
// Initial schema. Idempotent: every table is created only if missing, so a half-finished run can simply run again.
// Timestamps are stored as epoch milliseconds (bigInteger) so SQLite and MySQL behave the same.

exports.up = async function (knex) {
  // knex.schema returns a fresh builder each time; never reuse one (it would replay earlier statements).
  const create = async (name, fn) => { if (!(await knex.schema.hasTable(name))) await knex.schema.createTable(name, fn); };

  await create('restaurants', t => {
    t.increments('id');
    t.string('slug', 80).notNullable().unique();
    t.string('name', 120).notNullable();
    t.string('short_code', 6).notNullable();
    t.string('domain', 190).notNullable().defaultTo('');
    t.string('timezone', 64).notNullable().defaultTo('Australia/Melbourne');
    t.string('phone', 20).notNullable().defaultTo('');
    t.string('email', 190).notNullable().defaultTo('');
    t.string('address', 255).notNullable().defaultTo('');
    t.string('color', 9).notNullable().defaultTo('#24305a');
    t.text('extra_note');
    t.string('privacy_url', 255).notNullable().defaultTo('');
    t.text('week_hours').notNullable(); // JSON: 7 strings, index 0 = Sunday
    t.text('rules').notNullable(); // JSON
    t.boolean('online').notNullable().defaultTo(true);
    t.string('api_key_hash', 64).unique();
    t.string('api_key_prefix', 20).notNullable().defaultTo('');
    // The restaurant's own SiteGround mailbox for guest emails
    t.string('mail_from_name', 120).notNullable().defaultTo('');
    t.string('smtp_host', 190).notNullable().defaultTo('');
    t.integer('smtp_port').notNullable().defaultTo(465);
    t.string('smtp_user', 190).notNullable().defaultTo('');
    t.text('smtp_pass_enc');
    t.string('mail_status', 20).notNullable().defaultTo('none'); // none | ok | failed
    t.string('mail_error', 255).notNullable().defaultTo('');
    t.bigInteger('mail_checked_at');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('updated_at').notNullable();
  });

  await create('special_dates', t => {
    t.increments('id');
    t.integer('restaurant_id').unsigned().notNullable().references('restaurants.id').onDelete('CASCADE');
    t.string('date', 10).notNullable();
    t.string('hours', 120).notNullable().defaultTo('');
    t.string('note', 120).notNullable().defaultTo('');
    t.unique(['restaurant_id', 'date']);
  });

  await create('users', t => {
    t.increments('id');
    t.string('name', 120).notNullable();
    t.string('email', 190).notNullable().unique();
    t.string('password_hash', 100);
    t.string('role', 10).notNullable().defaultTo('staff'); // owner | staff
    t.string('lang', 2).notNullable().defaultTo('vi');
    t.boolean('active').notNullable().defaultTo(true);
    t.integer('failed_logins').notNullable().defaultTo(0);
    t.bigInteger('locked_until');
    t.bigInteger('last_login_at');
    t.bigInteger('created_at').notNullable();
  });

  await create('user_restaurants', t => {
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.integer('restaurant_id').unsigned().notNullable().references('restaurants.id').onDelete('CASCADE');
    t.primary(['user_id', 'restaurant_id']);
  });

  await create('sessions', t => {
    t.string('id', 64).primary(); // sha256 of the cookie token
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('last_seen_at').notNullable();
    t.string('ip', 64).notNullable().defaultTo('');
    t.string('user_agent', 255).notNullable().defaultTo('');
  });

  await create('tokens', t => {
    t.increments('id');
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.string('kind', 10).notNullable(); // reset | invite
    t.string('token_hash', 64).notNullable().unique();
    t.bigInteger('expires_at').notNullable();
    t.bigInteger('used_at');
    t.bigInteger('created_at').notNullable();
  });

  await create('bookings', t => {
    t.increments('id');
    t.string('ref', 12).notNullable().unique();
    t.integer('restaurant_id').unsigned().notNullable().references('restaurants.id').onDelete('CASCADE');
    t.string('date', 10).notNullable();
    t.integer('time_min').notNullable();
    t.bigInteger('starts_at').notNullable();
    t.integer('party').notNullable();
    t.string('name', 130).notNullable();
    t.string('phone', 20).notNullable();
    t.string('email', 190).notNullable().defaultTo('');
    t.text('note');
    t.string('status', 12).notNullable(); // pending confirmed seated noshow declined cancelled expired
    t.string('source', 10).notNullable(); // web hosted staff
    t.string('decline_reason', 255).notNullable().defaultTo('');
    t.string('cancel_reason', 255).notNullable().defaultTo('');
    t.boolean('override').notNullable().defaultTo(false);
    t.boolean('seen').notNullable().defaultTo(false);
    t.bigInteger('reminded_at');
    t.integer('created_by').unsigned().references('users.id').onDelete('SET NULL');
    t.string('ip', 64).notNullable().defaultTo('');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('updated_at').notNullable();
    t.index(['restaurant_id', 'date']);
    t.index(['phone']);
    t.index(['status']);
    t.index(['updated_at']);
  });

  await create('booking_events', t => {
    t.increments('id');
    t.integer('booking_id').unsigned().notNullable().references('bookings.id').onDelete('CASCADE');
    t.bigInteger('at').notNullable();
    t.string('actor', 190).notNullable(); // user name, or 'guest' / 'system'
    t.string('kind', 30).notNullable();
    t.string('detail', 500).notNullable().defaultTo('');
    t.index(['booking_id']);
  });

  await create('emails', t => {
    t.increments('id');
    t.integer('booking_id').unsigned().references('bookings.id').onDelete('SET NULL');
    t.integer('restaurant_id').unsigned().references('restaurants.id').onDelete('SET NULL');
    t.string('kind', 20).notNullable();
    t.string('to_addr', 190).notNullable();
    t.string('from_addr', 255).notNullable().defaultTo('');
    t.string('reply_to', 190).notNullable().defaultTo('');
    t.string('subject', 255).notNullable();
    t.text('html', 'mediumtext').notNullable();
    t.text('text');
    t.string('status', 10).notNullable().defaultTo('pending'); // pending sent failed logged
    t.string('via', 12).notNullable().defaultTo(''); // restaurant | system | log
    t.string('error', 255).notNullable().defaultTo('');
    t.integer('attempts').notNullable().defaultTo(0);
    t.bigInteger('created_at').notNullable();
    t.bigInteger('sent_at');
    t.index(['status']);
    t.index(['booking_id']);
  });

  await create('audit_log', t => {
    t.increments('id');
    t.bigInteger('at').notNullable();
    t.integer('user_id').unsigned().references('users.id').onDelete('SET NULL');
    t.string('actor', 190).notNullable();
    t.string('action', 40).notNullable();
    t.string('detail', 500).notNullable().defaultTo('');
    t.string('ip', 64).notNullable().defaultTo('');
    t.index(['at']);
  });

  await create('settings', t => {
    t.string('key', 60).primary();
    t.text('value').notNullable();
  });
};

exports.down = async function (knex) {
  for (const t of ['settings', 'audit_log', 'emails', 'booking_events', 'bookings', 'tokens', 'sessions', 'user_restaurants', 'users', 'special_dates', 'restaurants']) {
    await knex.schema.dropTableIfExists(t);
  }
};
