'use strict';
// SiteGround keeps a full copy of the app for every deploy in public_html/.nodeapp/ and never removes old ones.
// This removes old deploy folders so the hosting account stays under its inode limit.
// Safety rules: only inside a folder named .nodeapp that has a `latest` link pointing inside it;
// only real folders named <10-digit timestamp>-<id>; never origin/1234567890*; only folders older than
// BOTH the running folder and `latest`; the newest of those is kept as a fallback.
const fs = require('fs');
const path = require('path');
const log = require('./logger');

const NAME = /^(\d{10})-[a-z0-9]+$/;
let last = null;

async function cleanup({ appDir, dryRun = false } = {}) {
  const res = { at: Date.now(), running: null, latest: null, removed: [], kept: [], skipped: null, errors: [] };
  try {
    const real = fs.realpathSync(appDir);
    const parent = path.dirname(real);
    res.running = path.basename(real);
    if (path.basename(parent) !== '.nodeapp') { res.skipped = 'not_siteground'; return finish(res); }
    const latestLink = path.join(parent, 'latest');
    if (!fs.existsSync(latestLink)) { res.skipped = 'no_latest'; return finish(res); }
    const latestReal = fs.realpathSync(latestLink);
    if (path.dirname(latestReal) !== parent) { res.skipped = 'latest_outside'; return finish(res); }
    res.latest = path.basename(latestReal);
    const tsOf = n => { const m = NAME.exec(n); return m ? Number(m[1]) : null; };
    const limit = Math.min(...[res.running, res.latest].map(tsOf).filter(x => x != null));
    if (!Number.isFinite(limit)) { res.skipped = 'unknown_running'; return finish(res); }
    const entries = await fs.promises.readdir(parent, { withFileTypes: true });
    const older = entries
      .filter(e => e.isDirectory() && !e.isSymbolicLink())
      .map(e => e.name)
      .filter(n => NAME.test(n) && !n.includes('origin') && !n.startsWith('1234567890'))
      .filter(n => n !== res.running && n !== res.latest && tsOf(n) < limit)
      .sort((a, b) => tsOf(b) - tsOf(a));
    if (older.length) res.kept.push(older.shift()); // newest older folder stays as a fallback
    for (const n of older) {
      if (dryRun) { res.removed.push(n); continue; }
      try {
        await fs.promises.rm(path.join(parent, n), { recursive: true, force: true });
        res.removed.push(n);
      } catch (e) { res.errors.push(`${n}: ${e.message}`); }
      await new Promise(r => setImmediate(r)); // let requests run between folders
    }
  } catch (e) { res.errors.push(e.message); }
  return finish(res);
}
function finish(res) { last = res; if (res.removed.length || res.errors.length) log.info('Deploy clean-up', res); return res; }
const lastResult = () => last;

module.exports = { cleanup, lastResult };
