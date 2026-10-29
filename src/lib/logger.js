'use strict';
// Logs to the console and to logs/app.log (rotated at ~5 MB), since SiteGround's panel shows no console output.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', '..', 'logs');
const file = path.join(dir, 'app.log');
const MAX = 5 * 1024 * 1024;
let size = 0;
let ok = true;
try { fs.mkdirSync(dir, { recursive: true }); size = fs.existsSync(file) ? fs.statSync(file).size : 0; } catch { ok = false; }

function write(level, args) {
  const msg = args.map(a => (a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? safe(a) : String(a))).join(' ');
  const line = `${new Date().toISOString()} [${level}] ${msg}\n`;
  (level === 'error' ? process.stderr : process.stdout).write(line);
  if (!ok || process.env.NODE_ENV === 'test') return;
  try {
    if (size + line.length > MAX) { fs.renameSync(file, file + '.1'); size = 0; }
    fs.appendFileSync(file, line); size += Buffer.byteLength(line);
  } catch { /* disk full or read-only: keep running */ }
}
function safe(o) { try { return JSON.stringify(o); } catch { return String(o); } }

module.exports = {
  info: (...a) => write('info', a),
  warn: (...a) => write('warn', a),
  error: (...a) => write('error', a),
};
