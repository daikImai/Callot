const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// SQLite DBファイルのパス
const dbPath = path.join(__dirname, './database/callot.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('DB接続エラー:', err.message);
    } else {
        console.log('DB接続成功');
    }
});

// JSONボディパース対応（POST等を使うなら必要）
app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// ルームIDの生成
function generateRoomID(length = 8, isDatesOnly = true) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let prefix = isDatesOnly ? "D" : "H";

  let result = '';
  for (let i = 1; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return prefix + result;
}

// 新規ルームの作成
app.post('/api/create-room', (req, res) => {
  const { roomName, isDatesOnly } = req.body;

  if (!roomName) {
    return res.status(400).json({ error: 'roomNameは必須です' });
  }

  function tryInsertRoom(retry = 0) {
    if (retry > 10) {
      return res.status(500).json({ error: 'RoomIDの生成に失敗しました（重複が多すぎ）' });
    }

    const roomid = generateRoomID(8, isDatesOnly);
    const sql = `INSERT INTO rooms (roomid, name) VALUES (?, ?)`;

    db.run(sql, [roomid, roomName], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          // 重複しているので再試行
          tryInsertRoom(retry + 1);
        } else {
          console.error('DB Error:', err);
          return res.status(500).json({ error: 'DBエラー' });
        }
      } else {
        res.json({ success: true, roomid, id: this.lastID });
      }
    });
  }

  tryInsertRoom();
});

// ニックネームと時間帯の保存
app.post('/api/save-nickname', (req, res) => {
  const { roomId, nickname, selectedDates, isDatesOnly } = req.body;

  const insertNickname = `INSERT INTO nicknames (name, room_id) VALUES (?, (
    SELECT id FROM rooms WHERE roomid = ?
  ))`;

  db.run(insertNickname, [nickname, roomId], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'ニックネームの保存に失敗しました' });
    }

    const nicknameId = this.lastID;
    const insertTimes = db.prepare(`INSERT INTO times (date, start_time, end_time, nickname_id) VALUES (?, ?, ?, ?)`);

    try {
      for (const [yearMonth, dates] of Object.entries(selectedDates)) {
        for (const [dateKey, value] of Object.entries(dates)) {
          const [year, month, day] = dateKey.split("-");
          const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          if (isDatesOnly) {
            insertTimes.run(date, null, null, nicknameId);
          } else {
            value.forEach(({ start, end }) => {
              insertTimes.run(date, start, end, nicknameId);
            });
          }
        }
      }

      insertTimes.finalize();
      res.json({ success: true, nicknameId });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: '時間情報の保存に失敗しました' });
    }
  });
});

// あるルーム内のニックネームを取得
app.get('/api/nicknames', (req, res) => {
    const { roomId } = req.query;

    if (!roomId) return res.status(400).json({ error: "roomIdが必要です" });

    const sql = `
        SELECT n.name FROM nicknames n
        JOIN rooms r ON n.room_id = r.id
        WHERE r.roomid = ?
    `;

    db.all(sql, [roomId], (err, rows) => {
        if (err) {
            console.error("DB取得エラー:", err);
            return res.status(500).json({ error: "データベースエラー" });
        }

        const nicknames = rows.map(row => row.name);
        res.json({ nicknames });
    });
});

// getSelectedDatesWithNicknames()
app.get("/api/selected-dates", (req, res) => {
    const { roomId, isDatesOnly } = req.query;
    if (!roomId) return res.status(400).json({ error: "roomIdが必要です" });

    const sql = `
        SELECT t.date, t.start_time, t.end_time, n.name AS nickname
        FROM times t
        JOIN nicknames n ON t.nickname_id = n.id
        JOIN rooms r ON n.room_id = r.id
        WHERE r.roomid = ?
    `;

    db.all(sql, [roomId], (err, rows) => {
        if (err) {
            console.error("DB取得エラー:", err);
            return res.status(500).json({ error: "DBエラー" });
        }

        const result = {}; // dateKey → [nickname] または [{nickname, start, end}]
        rows.forEach(row => {
            if (!result[row.date]) result[row.date] = [];

            if (isDatesOnly) {
                result[row.date].push(row.nickname);
            } else {
                result[row.date].push({
                    nickname: row.nickname,
                    start: row.start,
                    end: row.end
                });
            }
        });

        res.json({ selectedDatesWithNicknames: result });
    });
});

// --- API: ルームID存在チェック ---
app.get('/api/rooms/:roomId/exists', (req, res) => {
    const roomId = req.params.roomId;

    // roomsテーブルにroomidがあるか確認
    const sql = `SELECT COUNT(*) as count FROM rooms WHERE roomid = ?`;
    db.get(sql, [roomId], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'DBエラー' });
            return;
        }
        res.json({ exists: row.count > 0 });
    });
});

// --- API: ルーム名取得 ---
app.get('/api/rooms/:roomId/name', (req, res) => {
    const roomId = req.params.roomId;
    const sql = `SELECT name FROM rooms WHERE roomid = ?`;
    db.get(sql, [roomId], (err, row) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'DBエラー' });
            return;
        }
        if (row) {
            res.json({ roomName: row.name });
        } else {
            res.status(404).json({ error: 'ルームが見つかりません' });
        }
    });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
