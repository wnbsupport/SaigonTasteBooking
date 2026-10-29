'use strict';
// Web push: one row per device that turned on notifications. Idempotent.
exports.up = async function (knex) {
  if (await knex.schema.hasTable('push_subscriptions')) return;
  await knex.schema.createTable('push_subscriptions', t => {
    t.increments('id');
    t.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    t.string('endpoint_hash', 64).notNullable().unique();
    t.text('endpoint').notNullable();
    t.string('p256dh', 200).notNullable();
    t.string('auth', 100).notNullable();
    t.string('user_agent', 255).notNullable().defaultTo('');
    t.bigInteger('created_at').notNullable();
    t.bigInteger('last_ok_at');
    t.integer('fail_count').notNullable().defaultTo(0);
    t.index(['user_id']);
  });
};
exports.down = async function (knex) { await knex.schema.dropTableIfExists('push_subscriptions'); };
