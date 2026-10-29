'use strict';
// Secrets: random tokens, hashing for API keys / session tokens, and encryption for restaurant mailbox passwords.
const crypto = require('crypto');
const config = require('../config');

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');

function key() {
  if (!config.encryptionKey || config.encryptionKey.length < 16) {
    const e = new Error('ENCRYPTION_KEY chưa được cài (cần ít nhất 16 ký tự) nên chưa lưu được mật khẩu email.');
    e.code = 'NO_ENCRYPTION_KEY'; e.status = 400; throw e;
  }
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}
function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}
function decrypt(blob) {
  if (!blob) return '';
  const [v, iv, tag, data] = String(blob).split(':');
  if (v !== 'v1') throw new Error('Unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
const hasKey = () => !!config.encryptionKey && config.encryptionKey.length >= 16;

// Booking references: no 0/O/1/I so they read clearly over the phone.
const REF_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function refCode(prefix) {
  const b = crypto.randomBytes(5); let s = '';
  for (let i = 0; i < 5; i++) s += REF_ALPHA[b[i] % REF_ALPHA.length];
  return `${prefix}-${s}`;
}

module.exports = { randomToken, sha256, encrypt, decrypt, hasKey, refCode };
