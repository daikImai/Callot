const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DBファイルのパス
const dbPath = path.resolve(__dirname, 'database', 'callot.db');

// データベース接続
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
if (err) {
    console.error('DB Connection Error:', err.message);
  } else {
    console.log('DB Connection Successful');
  }
});

module.exports = db;
