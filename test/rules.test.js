'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DateTime } = require('luxon');
const R = require('../src/lib/rules');

test('parseSessions reads opening hours and rejects bad input', () => {
  assert.deepEqual(R.parseSessions('08:00-17:00, 18:00-21:00'), [[480, 1020], [1080, 1260]]);
  assert.deepEqual(R.parseSessions(''), []);
  assert.deepEqual(R.parseSessions('8.30 – 15.00'), [[510, 900]]);
  assert.equal(R.parseSessions('17:00-16:00'), null);
  assert.equal(R.parseSessions('08:00-12:00, 11:00-14:00'), null, 'overlapping sessions');
  assert.equal(R.parseSessions('lunch'), null);
  assert.equal(R.parseSessions('08:00-25:00'), null);
});

test('normPhone accepts Australian numbers only', () => {
  assert.equal(R.normPhone('0412 345 678'), '0412345678');
  assert.equal(R.normPhone('+61 412 345 678'), '0412345678');
  assert.equal(R.normPhone('(03) 9532 7353'), '0395327353');
  assert.equal(R.normPhone('412345678'), '0412345678');
  assert.equal(R.normPhone('0912 345 678'), null);
  assert.equal(R.normPhone('12345'), null);
  assert.equal(R.fmtPhone('0412345678'), '0412 345 678');
  assert.equal(R.fmtPhone('0395327353'), '(03) 9532 7353');
});

const base = { id: 1, timezone: 'Australia/Melbourne', online: true, week_hours: Array(7).fill('08:00-17:00, 18:00-21:00'), rules: R.normalizeRules({ interval: 30, lastBefore: 60, lead: 120, maxDays: 30, cap: 10 }) };
const at = (date, hm) => DateTime.fromISO(`${date}T${hm}`, { zone: 'Australia/Melbourne' }).toMillis();

test('slots stop before closing and respect minimum notice', () => {
  const date = '2026-11-10'; // a Tuesday
  const s = R.slotsFor({ restaurant: base, specials: [], date, now: at('2026-11-10', '09:10') });
  assert.equal(s.state, 'ok');
  const times = s.groups.flatMap(g => g.slots.map(x => x.time));
  assert.equal(times[0], '11:30', 'needs 2 hours notice from 09:10');
  assert.ok(times.includes('16:00') && !times.includes('16:30'), 'last booking 60 min before 17:00');
  assert.ok(times.includes('20:00') && !times.includes('20:30'));
  assert.ok(!times.includes('17:00') && !times.includes('17:30'), 'no times between sessions');
  assert.deepEqual(s.groups.map(g => g.meal), ['lunch', 'afternoon', 'dinner']);
});

test('closed days, special dates, paused, past and too far', () => {
  const r = { ...base, week_hours: base.week_hours.map((h, i) => (i === 1 ? '' : h)) }; // closed Mondays
  const now = at('2026-11-01', '07:00');
  assert.equal(R.slotsFor({ restaurant: r, specials: [], date: '2026-11-09', now }).state, 'closed');
  const sp = [{ date: '2026-12-25', hours: '', note: 'Christmas Day' }, { date: '2026-11-11', hours: '10:00-12:00', note: '' }];
  const xmas = R.slotsFor({ restaurant: { ...r, rules: { ...r.rules, maxDays: 90 } }, specials: sp, date: '2026-12-25', now });
  assert.equal(xmas.state, 'closed'); assert.equal(xmas.note, 'Christmas Day');
  const short = R.slotsFor({ restaurant: r, specials: sp, date: '2026-11-11', now });
  assert.deepEqual(short.groups.flatMap(g => g.slots.map(x => x.time)), ['10:00', '10:30', '11:00']);
  assert.equal(R.slotsFor({ restaurant: { ...r, online: false }, specials: [], date: '2026-11-10', now }).state, 'paused');
  assert.equal(R.slotsFor({ restaurant: r, specials: [], date: '2026-10-31', now }).state, 'past');
  assert.equal(R.slotsFor({ restaurant: r, specials: [], date: '2026-12-20', now }).state, 'toofar');
});

test('capacity marks a slot full for the party size', () => {
  const covers = new Map([[R.toMin('12:00'), 8]]);
  const s = R.slotsFor({ restaurant: base, specials: [], date: '2026-11-10', party: 3, covers, now: at('2026-11-09', '12:00') });
  const slot = s.groups.flatMap(g => g.slots).find(x => x.time === '12:00');
  assert.equal(slot.full, true);
  const s2 = R.slotsFor({ restaurant: base, specials: [], date: '2026-11-10', party: 2, covers, now: at('2026-11-09', '12:00') });
  assert.equal(s2.groups.flatMap(g => g.slots).find(x => x.time === '12:00').full, false);
});

test('start times follow the restaurant time zone across daylight saving', () => {
  // Melbourne: AEDT (+11) in November, AEST (+10) in June
  assert.equal(new Date(R.startsAt('Australia/Melbourne', '2026-11-10', 12 * 60)).toISOString(), '2026-11-10T01:00:00.000Z');
  assert.equal(new Date(R.startsAt('Australia/Melbourne', '2026-06-10', 12 * 60)).toISOString(), '2026-06-10T02:00:00.000Z');
  assert.equal(new Date(R.startsAt('Australia/Brisbane', '2026-11-10', 12 * 60)).toISOString(), '2026-11-10T02:00:00.000Z');
  assert.equal(R.weekday('2026-11-08'), 0); // Sunday
});
