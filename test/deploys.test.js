'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cleanup } = require('../src/lib/deploys');

function fakeNodeapp(names, latest) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stb-deploy-'));
  const na = path.join(root, '.nodeapp');
  fs.mkdirSync(na);
  for (const n of names) { fs.mkdirSync(path.join(na, n, 'node_modules', 'x'), { recursive: true }); fs.writeFileSync(path.join(na, n, 'index.js'), ''); }
  for (const f of ['.env-local', 'app.json', 'app_source.zip']) fs.writeFileSync(path.join(na, f), 'x');
  if (latest) fs.symlinkSync(latest, path.join(na, 'latest'));
  return { root, na };
}

test('removes only old deploys, keeps origin, running, latest, one fallback and newer folders', async () => {
  const names = ['1234567890-origin', '1793100000-aaa111', '1793100100-bbb222', '1793100200-ccc333', '1793100300-ddd444', '1793100400-eee555', '1793100500-fff666'];
  const { root, na } = fakeNodeapp(names, '1793100400-eee555');
  const res = await cleanup({ appDir: path.join(na, '1793100400-eee555') });
  assert.equal(res.skipped, null);
  assert.deepEqual(res.removed.sort(), ['1793100000-aaa111', '1793100100-bbb222', '1793100200-ccc333']);
  assert.deepEqual(res.kept, ['1793100300-ddd444']);
  const left = fs.readdirSync(na).sort();
  assert.deepEqual(left, ['.env-local', '1234567890-origin', '1793100300-ddd444', '1793100400-eee555', '1793100500-fff666', 'app.json', 'app_source.zip', 'latest']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('running through the latest link resolves to the real folder', async () => {
  const { root, na } = fakeNodeapp(['1793100000-aaa111', '1793100100-bbb222', '1793100200-ccc333'], '1793100200-ccc333');
  const res = await cleanup({ appDir: path.join(na, 'latest') });
  assert.equal(res.running, '1793100200-ccc333');
  assert.deepEqual(res.removed, ['1793100000-aaa111']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('does nothing without a latest link or outside .nodeapp', async () => {
  const { root, na } = fakeNodeapp(['1793100000-aaa111', '1793100100-bbb222', '1793100200-ccc333'], null);
  const res = await cleanup({ appDir: path.join(na, '1793100200-ccc333') });
  assert.equal(res.skipped, 'no_latest');
  assert.equal(fs.readdirSync(na).filter(n => /^\d{10}-/.test(n)).length, 3);
  const res2 = await cleanup({ appDir: root });
  assert.equal(res2.skipped, 'not_siteground');
  fs.rmSync(root, { recursive: true, force: true });
});
