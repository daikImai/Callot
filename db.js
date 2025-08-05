const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// DBファイルのパス
const dbPath = path.resolve(__dirname, 'database', 'callot.db');

// データベース接続
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite接続エラー:', err.message);
  } else {
    console.log('SQLiteに接続しました');
  }
});

module.exports = db;
