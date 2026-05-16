const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let _db = null;
let _dbPath = null;

function persist() {
  if (!_db || !_dbPath) return;
  const data = _db.export();
  fs.writeFileSync(_dbPath, Buffer.from(data));
}

function exec(sql, params = []) {
  if (params.length === 0) {
    _db.run(sql);
    return;
  }
  const stmt = _db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function query(sql, params = []) {
  const stmt = _db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function init() {
  const SQL = await initSqlJs({
    locateFile: () => path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  });

  _dbPath = path.join(app.getPath('userData'), 'outbox.db');

  if (fs.existsSync(_dbPath)) {
    const buf = fs.readFileSync(_dbPath);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt INTEGER,
      status TEXT DEFAULT 'pending'
    )
  `);

  persist();
  console.log('[DB] initialized at', _dbPath);
}

function insertEvent(userId, eventType, payload) {
  exec(
    `INSERT INTO outbox (user_id, event_type, payload, created_at) VALUES (?, ?, ?, ?)`,
    [userId, eventType, JSON.stringify(payload), Date.now()]
  );
  persist();
  console.log(`[DB] inserted: ${eventType} | stats:`, getStats());
}

function getPendingEvents(limit = 50) {
  return query(
    `SELECT * FROM outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}

function markSent(ids) {
  if (!ids || ids.length === 0) return;
  for (const id of ids) {
    exec(`UPDATE outbox SET status = 'sent' WHERE id = ?`, [id]);
  }
  persist();
}

function markFailed(ids) {
  if (!ids || ids.length === 0) return;
  const now = Date.now();
  for (const id of ids) {
    exec(
      `UPDATE outbox SET attempts = attempts + 1, last_attempt = ?, status = 'failed' WHERE id = ?`,
      [now, id]
    );
  }
  persist();
}

function retryFailed() {
  const cutoff = Date.now() - 30_000;
  exec(
    `UPDATE outbox SET status = 'pending'
     WHERE status = 'failed' AND attempts < 5 AND last_attempt < ?`,
    [cutoff]
  );
}

function getStats() {
  const rows = query(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'sent'    THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) AS failed
    FROM outbox
  `);
  const row = rows[0] || {};
  return {
    pending: row.pending || 0,
    sent: row.sent || 0,
    failed: row.failed || 0
  };
}

module.exports = { init, insertEvent, getPendingEvents, markSent, markFailed, retryFailed, getStats };