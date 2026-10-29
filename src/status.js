'use strict';
// Start-up state shared by /api/health and the "wait for database" middleware.
const status = {
  state: 'starting', // starting | ready | error
  error: null,
  errorCode: null,
  startedAt: Date.now(),
  readyAt: null,
  attempts: 0,
  migrations: [],
  waiters: [],
  setReady() {
    this.state = 'ready'; this.error = null; this.errorCode = null; this.readyAt = Date.now();
    this.waiters.splice(0).forEach(fn => fn(true));
  },
  setError(err) {
    this.state = 'error'; this.error = explain(err); this.errorCode = err && err.code || null;
  },
  waitReady(ms) {
    if (this.state === 'ready') return Promise.resolve(true);
    return new Promise(resolve => {
      const t = setTimeout(() => { const i = this.waiters.indexOf(fn); if (i >= 0) this.waiters.splice(i, 1); resolve(false); }, ms);
      const fn = v => { clearTimeout(t); resolve(v); };
      this.waiters.push(fn);
    });
  },
};

// Database errors in plain words, so the owner can fix them from a browser.
function explain(err) {
  if (!err) return null;
  const c = err.code || '';
  const map = {
    ER_ACCESS_DENIED_ERROR: 'Sai tên người dùng hoặc mật khẩu MySQL (DB_USER / DB_PASSWORD).',
    ER_BAD_DB_ERROR: 'Không tìm thấy database (DB_NAME). Kiểm tra tên database trong Site Tools → MySQL.',
    ER_DBACCESS_DENIED_ERROR: 'Người dùng MySQL chưa được cấp quyền vào database này. Vào Site Tools → MySQL và cấp "All privileges".',
    ECONNREFUSED: 'Không kết nối được máy chủ MySQL (DB_HOST). Trên SiteGround dùng DB_HOST=localhost.',
    ENOTFOUND: 'Không tìm thấy máy chủ MySQL (DB_HOST sai).',
    ETIMEDOUT: 'Kết nối MySQL bị quá thời gian. Thử lại sau ít phút.',
    PROTOCOL_CONNECTION_LOST: 'Mất kết nối MySQL. Ứng dụng sẽ tự thử lại.',
  };
  if (map[c]) return map[c];
  if (/Knex: Timeout acquiring a connection/i.test(err.message)) return 'Không lấy được kết nối MySQL (quá thời gian). Kiểm tra DB_HOST, DB_USER, DB_PASSWORD.';
  return `Lỗi database${c ? ` (mã ${c})` : ''}. Chi tiết trong file logs/app.log (mở bằng File Manager).`;
}

module.exports = status;
