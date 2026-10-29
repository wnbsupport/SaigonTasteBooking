'use strict';
// "Remember me" on sessions. Existing sessions count as remembered. Idempotent.
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('sessions', 'remember'))) {
    await knex.schema.alterTable('sessions', t => { t.boolean('remember').notNullable().defaultTo(true); });
  }
};
exports.down = async function (knex) {
  if (await knex.schema.hasColumn('sessions', 'remember')) await knex.schema.alterTable('sessions', t => { t.dropColumn('remember'); });
};
