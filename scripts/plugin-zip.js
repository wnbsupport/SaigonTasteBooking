'use strict';
// Copies the shared form widget into the WordPress plugin and builds dist/saigontaste-booking.zip (needs the `zip` command).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const plugin = path.join(root, 'wordpress-plugin', 'saigontaste-booking');
for (const f of ['booking-widget.js', 'booking-widget.css']) fs.copyFileSync(path.join(root, 'public', 'widget', f), path.join(plugin, 'assets', f));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'saigontaste-booking.zip');
fs.rmSync(out, { force: true });
execFileSync('zip', ['-r', '-X', out, 'saigontaste-booking', '-x', '*.DS_Store'], { cwd: path.join(root, 'wordpress-plugin'), stdio: 'inherit' });
console.log('Built', out);
