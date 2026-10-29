'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./helpers');

let owner, KEY_MD;
let ipN = 10;
const nextIp = () => `198.51.100.${ipN++}`;
const guestBody = (over = {}) => ({ date: H.dayIn(3), time: '12:00', party: 2, first: 'Emily', last: 'Tran', phone: '0401 333 444', email: 'emily@example.com', note: 'Window please', consent: true, elapsed: 6000, ...over });
const book = (body, ip = nextIp()) => fetch(`${base()}/api/public/v1/book`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY_MD}`, 'X-Client-IP': ip }, body: JSON.stringify(body) }).then(async r => ({ status: r.status, body: await r.json() }));
let BASE; const base = () => BASE;

test.before(async () => {
  BASE = await H.start();
  owner = H.client();
  const r = await owner.login('owner@test.au', 'owner-password-1');
  assert.equal(r.status, 200);
  const k = await owner.post('/api/restaurants/1/key');
  KEY_MD = k.body.key;
});
test.after(H.stop);

test('health reports the database', async () => {
  const r = await H.client().get('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.database, 'ok');
});

test('first start creates the owner and the two restaurants', async () => {
  const me = await owner.get('/api/auth/me');
  assert.equal(me.body.user.role, 'owner');
  assert.deepEqual(me.body.restaurants.map(r => r.name), ['Mandoline', 'Touchstone Cafe']);
});

test('public form: info and availability by key and by hosted slug', async () => {
  const anon = H.client();
  const info = await anon.post('/api/public/v1/r/touchstone-cafe/info');
  assert.equal(info.status, 200);
  assert.equal(info.body.name, 'Touchstone Cafe');
  assert.equal(info.body.maxParty, 8);
  const bad = await fetch(`${base()}/api/public/v1/info`, { method: 'POST', headers: { Authorization: 'Bearer st_nope', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(bad.status, 401);
  const av = await fetch(`${base()}/api/public/v1/availability`, { method: 'POST', headers: { Authorization: `Bearer ${KEY_MD}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ date: H.dayIn(3), party: 2 }) }).then(r => r.json());
  assert.equal(av.state, 'ok');
  assert.ok(av.groups.length > 0);
});

test('a guest booking lands as pending and emails the restaurant', async () => {
  const before = H.sent.length;
  const r = await book(guestBody());
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.match(r.body.ref, /^MD-[A-Z2-9]{5}$/);
  const p = await owner.get('/api/bookings/pending');
  const b = p.body.bookings.find(x => x.ref === r.body.ref);
  assert.equal(b.status, 'pending');
  assert.equal(b.phone, '0401333444');
  assert.equal(b.seen, false);
  const mail = H.sent.slice(before).find(m => /New booking request/.test(m.subject));
  assert.ok(mail, 'restaurant alert sent');
  assert.equal(mail.to, 'bookings@mandolinerestaurant.com.au');
});

test('the server rejects times outside opening hours, duplicates and bad fields', async () => {
  let r = await book(guestBody({ time: '03:00', phone: '0401 000 001' }));
  assert.equal(r.status, 422); assert.equal(r.body.errors.time, 'outside');
  r = await book(guestBody({ time: '12:15', phone: '0401 000 002' }));
  assert.equal(r.status, 422, 'not on the 30-minute grid'); assert.equal(r.body.errors.time, 'outside');
  r = await book(guestBody());
  assert.equal(r.status, 422); assert.equal(r.body.errors.dup, 'exists');
  r = await book(guestBody({ phone: '12345', email: 'nope', first: '', consent: false, party: 50 }));
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.body.errors).sort(), ['consent', 'email', 'first', 'party', 'phone']);
});

test('honeypot and instant submits look successful but store nothing', async () => {
  const p0 = (await owner.get('/api/bookings/pending')).body.bookings.length;
  let r = await book(guestBody({ phone: '0401 000 010', website: 'http://spam' }));
  assert.equal(r.status, 200); assert.equal(r.body.ok, true);
  r = await book(guestBody({ phone: '0401 000 011', elapsed: 300 }));
  assert.equal(r.body.ok, true);
  assert.equal((await owner.get('/api/bookings/pending')).body.bookings.length, p0);
});

test('capacity: a full slot is refused', async () => {
  await owner.put('/api/restaurants/1', { rules: { cap: 6 } });
  const date = H.dayIn(4);
  assert.equal((await book(guestBody({ date, time: '13:00', party: 4, phone: '0401 100 001' }))).status, 201);
  const r = await book(guestBody({ date, time: '13:00', party: 4, phone: '0401 100 002' }));
  assert.equal(r.status, 422); assert.equal(r.body.errors.time, 'full');
  assert.equal((await book(guestBody({ date, time: '13:00', party: 2, phone: '0401 100 003' }))).status, 201);
  await owner.put('/api/restaurants/1', { rules: { cap: 40 } });
});

test('confirm sends the guest email from the restaurant mailbox, with fallback to the system mailbox', async () => {
  // Restaurant mailbox set up
  const up = await owner.put('/api/restaurants/1', { mail: { fromName: 'Mandoline', host: 'mail.mandoline.test', port: 465, user: 'bookings@mandolinerestaurant.com.au', pass: 'secret-1' } });
  assert.equal(up.status, 200, JSON.stringify(up.body));
  assert.equal(up.body.restaurant.mail.passSet, true);
  assert.equal(JSON.stringify(up.body).includes('secret-1'), false, 'password never returned');
  const row = await H.db()('restaurants').where({ id: 1 }).first();
  assert.ok(row.smtp_pass_enc.startsWith('v1:') && !row.smtp_pass_enc.includes('secret-1'), 'stored encrypted');

  const r = await book(guestBody({ phone: '0401 200 001', email: 'g1@example.com' }));
  const id = (await owner.get('/api/bookings/pending')).body.bookings.find(b => b.ref === r.body.ref).id;
  const n = H.sent.length;
  const c = await owner.post(`/api/bookings/${id}/confirm`);
  assert.equal(c.status, 200); assert.equal(c.body.booking.status, 'confirmed');
  const m = H.sent[n];
  assert.equal(m.host, 'mail.mandoline.test');
  assert.equal(m.from, '"Mandoline" <bookings@mandolinerestaurant.com.au>');
  assert.equal(m.to, 'g1@example.com');
  assert.equal(m.replyTo, undefined, 'sent from the restaurant mailbox: replies go straight back to it');
  assert.match(m.subject, /^Booking confirmed – Mandoline/);
  assert.equal((await owner.post(`/api/bookings/${id}/confirm`)).status, 409, 'cannot confirm twice');

  // Restaurant mailbox fails → system mailbox sends, replies still go to the restaurant
  H.failHosts.add('mail.mandoline.test');
  const r2 = await book(guestBody({ phone: '0401 200 002', email: 'g2@example.com' }));
  const id2 = (await owner.get('/api/bookings/pending')).body.bookings.find(b => b.ref === r2.body.ref).id;
  const n2 = H.sent.length;
  await owner.post(`/api/bookings/${id2}/decline`, { reason: 'Fully booked' });
  const m2 = H.sent[n2];
  assert.equal(m2.host, 'smtp.system.test');
  assert.equal(m2.from, '"Mandoline" <bookings@saigontaste.test>');
  assert.equal(m2.replyTo, 'bookings@mandolinerestaurant.com.au');
  assert.match(m2.html, /Fully booked/);
  const det = await owner.get(`/api/bookings/${id2}`);
  assert.equal(det.body.emails.find(e => e.kind === 'decline').via, 'fallback');
  const rest = await owner.get('/api/restaurants');
  assert.equal(rest.body.restaurants[0].mail.status, 'failed');
  const test1 = await owner.post('/api/restaurants/1/mail-test', { to: 'owner@test.au' });
  assert.equal(test1.body.ok, false); assert.match(test1.body.error, /mật khẩu/);
  H.failHosts.delete('mail.mandoline.test');
  const test2 = await owner.post('/api/restaurants/1/mail-test', { to: 'owner@test.au' });
  assert.equal(test2.body.ok, true);
});

test('status flow, undo, cancel needs a reason, and history', async () => {
  const r = await book(guestBody({ phone: '0401 300 001', email: 'g3@example.com' }));
  const id = (await owner.get('/api/bookings/pending')).body.bookings.find(b => b.ref === r.body.ref).id;
  await owner.post(`/api/bookings/${id}/confirm`);
  assert.equal((await owner.post(`/api/bookings/${id}/cancel`, {})).status, 400);
  assert.equal((await owner.post(`/api/bookings/${id}/noshow`)).body.booking.status, 'noshow');
  assert.equal((await owner.post(`/api/bookings/${id}/undo`)).body.booking.status, 'confirmed');
  assert.equal((await owner.post(`/api/bookings/${id}/cancel`, { reason: 'Guest called' })).body.booking.status, 'cancelled');
  const d = await owner.get(`/api/bookings/${id}`);
  assert.deepEqual(d.body.events.map(e => e.kind), ['created_web', 'confirm', 'email_confirm', 'noshow', 'undo', 'cancel']);
});

test('guest history counts visits and no-shows across restaurants', async () => {
  const k = H.db();
  const t = Date.now();
  const mk = (rid, status, date) => ({ ref: 'HX-' + Math.random().toString(36).slice(2, 7).toUpperCase(), restaurant_id: rid, date, time_min: 600, starts_at: t - 864e5, party: 2, name: 'Liam Walker', phone: '0422333444', email: 'liam@example.com', note: '', status, source: 'web', created_at: t, updated_at: t });
  await k('bookings').insert([mk(1, 'seated', '2026-09-01'), mk(2, 'seated', '2026-09-10'), mk(1, 'noshow', '2026-09-20')]);
  const r = await book(guestBody({ phone: '0422 333 444', first: 'Liam', last: 'Walker', email: 'liam@example.com' }));
  const b = (await owner.get('/api/bookings/pending')).body.bookings.find(x => x.ref === r.body.ref);
  assert.deepEqual(b.guest, { seated: 2, noshow: 1 });
  const g = await owner.get('/api/bookings/guest?phone=0422%20333%20444');
  assert.equal(g.body.bookings.length, 4);
});

test('staff add bookings inside opening hours; only owners can override', async () => {
  const date = H.dayIn(5);
  let r = await owner.post('/api/bookings', { restaurantId: 1, date, time: '12:10', party: 3, name: 'Phone Guest', phone: '0411 222 333', email: '', sendEmail: true });
  assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.booking.status, 'confirmed');
  r = await owner.post('/api/bookings', { restaurantId: 1, date, time: '02:00', party: 3, name: 'Late Guest', phone: '0411 222 334' });
  assert.equal(r.status, 422); assert.equal(r.body.errors.time, 'outside');
  r = await owner.post('/api/bookings', { restaurantId: 1, date, time: '02:00', party: 3, name: 'Late Guest', phone: '0411 222 334', override: true });
  assert.equal(r.status, 201); assert.equal(r.body.booking.override, true);
});

test('staff only see their restaurant and cannot open owner pages', async () => {
  const inv = await owner.post('/api/admin/users', { name: 'Tom', email: 'tom@test.au', role: 'staff', lang: 'en', restaurantIds: [2] });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  const token = new URL(inv.body.link).searchParams.get('token');
  const tom = H.client();
  assert.equal((await tom.get('/api/auth/token?token=' + token)).body.email, 'tom@test.au');
  assert.equal((await tom.post('/api/auth/password', { token, password: 'short' })).status, 400);
  const set = await tom.post('/api/auth/password', { token, password: 'tom-password-1' });
  assert.equal(set.status, 200); assert.deepEqual(set.body.restaurants.map(r => r.name), ['Touchstone Cafe']);
  assert.equal((await tom.post('/api/auth/password', { token, password: 'tom-password-2' })).status, 404, 'link works once');
  const p = await tom.get('/api/bookings/pending');
  assert.ok(p.body.bookings.every(b => b.restaurantId === 2));
  const mdBooking = (await owner.get('/api/bookings/pending')).body.bookings.find(b => b.restaurantId === 1);
  assert.equal((await tom.post(`/api/bookings/${mdBooking.id}/confirm`)).status, 404);
  assert.equal((await tom.get(`/api/bookings/${mdBooking.id}`)).status, 404);
  assert.equal((await tom.get('/api/admin/users')).status, 403);
  assert.equal((await tom.put('/api/restaurants/2', { name: 'X' })).status, 403);
  assert.equal((await tom.post('/api/bookings', { restaurantId: 1, date: H.dayIn(5), time: '12:00', party: 2, name: 'Nope', phone: '0411 999 000' })).status, 404);
});

test('five wrong passwords lock the account for 15 minutes and email the owner', async () => {
  const c = H.client();
  let r;
  for (let i = 1; i <= 4; i++) { r = await c.login('tom@test.au', 'wrong-' + i); assert.equal(r.status, 401); }
  assert.equal(r.body.left, 1);
  const n = H.sent.length;
  r = await c.login('tom@test.au', 'wrong-5');
  assert.equal(r.status, 423); assert.equal(r.body.minutes, 15);
  assert.ok(H.sent.slice(n).some(m => m.to === 'owner@test.au' && /khóa|locked/i.test(m.subject)));
  r = await c.login('tom@test.au', 'tom-password-1');
  assert.equal(r.status, 423, 'still locked with the right password');
  const users = (await owner.get('/api/admin/users')).body.users;
  const tom = users.find(u => u.email === 'tom@test.au');
  assert.equal(tom.locked, true);
  await owner.post(`/api/admin/users/${tom.id}/unlock`);
  assert.equal((await c.login('tom@test.au', 'tom-password-1')).status, 200);
  const log = (await owner.get('/api/admin/audit?filter=security')).body.entries.map(e => e.action);
  assert.ok(log.includes('login_locked') && log.includes('login_failed') && log.includes('user_unlocked'));
});

test('idle sessions end; background polling does not keep them alive', async () => {
  const c = H.client();
  await c.login('tom@test.au', 'tom-password-1');
  const sid = require('crypto').createHash('sha256').update(decodeURIComponent(c.cookie.split('=')[1])).digest('hex');
  const old = Date.now() - 10 * 60000;
  await H.db()('sessions').where({ id: sid }).update({ last_seen_at: old });
  await c.get('/api/bookings/summary', { 'X-Background': '1' });
  assert.equal(Number((await H.db()('sessions').where({ id: sid }).first()).last_seen_at), old, 'polling did not refresh activity');
  await owner.put('/api/admin/settings', { idleMinutes: 15 });
  await H.db()('sessions').where({ id: sid }).update({ last_seen_at: Date.now() - 16 * 60000 });
  const r = await c.get('/api/bookings/pending');
  assert.equal(r.status, 401); assert.equal(r.body.reason, 'idle');
  await owner.put('/api/admin/settings', { idleMinutes: 30 });
});

test('requests from other sites are refused', async () => {
  const r = await owner.post('/api/bookings/seen', { ids: [] }, { Origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('CSV export neutralises spreadsheet formulas', async () => {
  const date = H.dayIn(6);
  await owner.post('/api/bookings', { restaurantId: 1, date, time: '12:00', party: 2, name: '=HYPERLINK("x")', phone: '0411 555 666', note: '+cmd' });
  const r = await owner.get(`/api/bookings/export.csv?date=${date}`);
  assert.equal(r.status, 200);
  assert.match(r.text, /"'=HYPERLINK\(""x""\)"/);
  assert.match(r.text, /'\+cmd/);
});

test('jobs: reminders after the set wait, and unanswered requests expire', async () => {
  const jobs = require('../src/lib/jobs');
  const r = await book(guestBody({ phone: '0401 400 001', date: H.dayIn(2) }));
  const k = H.db();
  await k('bookings').where({ ref: r.body.ref }).update({ created_at: Date.now() - 31 * 60000 });
  const n = H.sent.length;
  assert.equal(await jobs.sendReminders(), 1);
  assert.ok(H.sent.slice(n).some(m => /^Reminder/.test(m.subject)));
  assert.equal(await jobs.sendReminders(), 0, 'only once');
  await k('bookings').where({ ref: r.body.ref }).update({ starts_at: Date.now() - 60000 });
  await jobs.expirePending();
  assert.equal((await k('bookings').where({ ref: r.body.ref }).first()).status, 'expired');
});

test('staff cannot squeeze a booking in at an off-grid time while guests are still seated', async () => {
  await owner.put('/api/restaurants/1', { rules: { cap: 10, stay: 90 } });
  const date = H.dayIn(8);
  assert.equal((await owner.post('/api/bookings', { restaurantId: 1, date, time: '12:00', party: 8, name: 'Big Table', phone: '0411 700 001' })).status, 201);
  const r = await owner.post('/api/bookings', { restaurantId: 1, date, time: '12:40', party: 4, name: 'Squeeze', phone: '0411 700 002' });
  assert.equal(r.status, 422); assert.equal(r.body.errors.time, 'full');
  assert.equal((await owner.post('/api/bookings', { restaurantId: 1, date, time: '13:30', party: 4, name: 'After', phone: '0411 700 003' })).status, 201);
  const load = await owner.get(`/api/bookings/load?restaurant=1&date=${date}&time=12:40&party=4`);
  assert.equal(load.body.restaurants[0].peak, 8, 'the 12:00 group leaves at 13:30 as the 13:30 group arrives');
  const day = await owner.get(`/api/bookings/load?restaurant=1&date=${date}`);
  const at = Object.fromEntries(day.body.restaurants[0].slots.map(x => [x.time, x.guests]));
  assert.equal(at['12:00'], 8); assert.equal(at['13:00'], 8); assert.equal(at['13:30'], 4);
  const guestR = await book(guestBody({ date, time: '12:30', party: 3, phone: '0401 700 004' }));
  assert.equal(guestR.status, 422); assert.equal(guestR.body.errors.time, 'full');
  await owner.put('/api/restaurants/1', { rules: { cap: 40 } });
});

test('restaurant settings validate hours and special dates; new restaurant gets a key', async () => {
  let r = await owner.put('/api/restaurants/2', { week: ['08:30-15:00', 'nonsense', '', '', '', '', ''] });
  assert.equal(r.status, 422); assert.deepEqual(r.body.errors.week, [1]);
  r = await owner.put('/api/restaurants/2', { specials: [{ date: '2026-12-25', hours: '', note: 'Christmas Day' }, { date: '2026-12-25', hours: '', note: 'dup' }] });
  assert.equal(r.status, 422);
  r = await owner.put('/api/restaurants/2', { specials: [{ date: '2026-12-25', hours: '', note: 'Christmas Day' }], online: false });
  assert.equal(r.status, 200);
  const av = await H.client().post('/api/public/v1/r/touchstone-cafe/availability', { date: H.dayIn(2), party: 2 });
  assert.equal(av.body.state, 'paused');
  await owner.put('/api/restaurants/2', { online: true });
  const c = await owner.post('/api/restaurants', { name: 'Saigon Taste Richmond', phone: '03 9123 4567', email: 'hello@richmond.test' });
  assert.equal(c.status, 201); assert.match(c.body.key, /^st_/); assert.equal(c.body.restaurant.slug, 'saigon-taste-richmond');
  const page = await H.client().get('/book/saigon-taste-richmond');
  assert.equal(page.status, 200); assert.match(page.text, /Saigon Taste Richmond/);
});

test('restaurant alerts still go out through the restaurant mailbox when the system mailbox is missing', async () => {
  const config = require('../src/config');
  const saved = config.smtp.host;
  config.smtp.host = '';
  try {
    const n = H.sent.length;
    const r = await book(guestBody({ phone: '0401 500 001', date: H.dayIn(7) }));
    assert.equal(r.status, 201);
    const m = H.sent.slice(n).find(x => /New booking request/.test(x.subject));
    assert.ok(m, 'alert sent'); assert.equal(m.host, 'mail.mandoline.test');
  } finally { config.smtp.host = saved; }
});

test('missing body or a broken cookie does not crash the API', async () => {
  const r1 = await fetch(`${base()}/api/public/v1/r/mandoline/availability`, { method: 'POST' });
  assert.equal(r1.status, 400);
  const r2 = await fetch(`${base()}/api/auth/login`, { method: 'POST' });
  assert.equal(r2.status, 401);
  const r3 = await fetch(`${base()}/api/auth/me`, { headers: { Cookie: 'st_sid=%E0' } });
  assert.equal(r3.status, 401);
});

test('the app pages are served', async () => {
  const c = H.client();
  for (const p of ['/', '/password', '/manifest.webmanifest', '/sw.js', '/widget/booking-widget.js', '/icons/icon-192.png']) {
    assert.equal((await c.get(p)).status, 200, p);
  }
  assert.equal((await c.get('/book/nope')).status, 404);
});
