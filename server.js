const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// JSONボディパース対応
app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// ルームID生成
function generateRoomID(length = 8, isDatesOnly = true) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let prefix = isDatesOnly ? "D" : "H";
  let result = '';
  for (let i = 1; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return prefix + result;
}

// 新規ルーム作成
app.post('/api/create-room', async (req, res) => {
  const { roomName, isDatesOnly } = req.body;
  if (!roomName) return res.status(400).json({ error: 'roomNameは必須です' });

  for (let retry = 0; retry < 10; retry++) {
    const roomid = generateRoomID(8, isDatesOnly);
    const sql = `INSERT INTO rooms (roomid, name) VALUES ($1, $2) RETURNING id`;

    try {
      const result = await db.query(sql, [roomid, roomName]);
      return res.json({ success: true, roomid, id: result.rows[0].id });
    } catch (err) {
      if (err.code === '23505') continue; // UNIQUE violation, 再試行
      console.error(err);
      return res.status(500).json({ error: 'DBエラー' });
    }
  }

  res.status(500).json({ error: 'RoomIDの生成に失敗しました（重複が多すぎ）' });
});

// ニックネームと時間帯の保存
app.post('/api/save-nickname', async (req, res) => {
  const { roomId, nickname, selectedDates, isDatesOnly } = req.body;
  try {
    // nickname挿入
    const insertNicknameSql = `
      INSERT INTO nicknames (name, room_id)
      SELECT $1, id FROM rooms WHERE roomid = $2
      RETURNING id
    `;
    const nicknameResult = await db.query(insertNicknameSql, [nickname, roomId]);
    const nicknameId = nicknameResult.rows[0].id;

    // times挿入
    const insertTimeSql = `
      INSERT INTO times (date, start_time, end_time, nickname_id)
      VALUES ($1, $2, $3, $4)
    `;

    for (const dates of Object.values(selectedDates)) {
      for (const [dateKey, value] of Object.entries(dates)) {
        const [year, month, day] = dateKey.split('-');
        const date = `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
        if (isDatesOnly) {
          await db.query(insertTimeSql, [date, null, null, nicknameId]);
        } else {
          const { start, end } = value;
          await db.query(insertTimeSql, [date, start, end, nicknameId]);
        }
      }
    }

    res.json({ success: true, nicknameId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '時間情報の保存に失敗しました' });
  }
});

// あるルーム内のニックネームを取得
app.get('/api/nicknames', async (req, res) => {
  const { roomId } = req.query;
  if (!roomId) return res.status(400).json({ error: "roomIdが必要です" });

  const sql = `
    SELECT n.name FROM nicknames n
    JOIN rooms r ON n.room_id = r.id
    WHERE r.roomid = $1
  `;

  try {
    const result = await db.query(sql, [roomId]);
    const nicknames = result.rows.map(row => row.name);
    res.json({ nicknames });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "データベースエラー" });
  }
});

// 日付とニックネーム取得
app.get("/api/selected-dates-with-nicknames", async (req, res) => {
  const { roomId, isDatesOnly } = req.query;
  if (!roomId) return res.status(400).json({ error: "roomIdが必要です" });

  const isDatesOnlyBool = isDatesOnly === "true";

  const sql = `
    SELECT t.date, t.start_time, t.end_time, n.name AS nickname
    FROM times t
    JOIN nicknames n ON t.nickname_id = n.id
    JOIN rooms r ON n.room_id = r.id
    WHERE r.roomid = $1
  `;

  try {
    const result = await db.query(sql, [roomId]);
    const output = {};

    result.rows.forEach(row => {
      if (!output[row.date]) output[row.date] = [];
      if (isDatesOnlyBool) {
        output[row.date].push(row.nickname);
      } else {
        output[row.date].push({
          nickname: row.nickname,
          start: row.start_time,
          end: row.end_time
        });
      }
    });

    res.json({ selectedDatesWithNicknames: output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DBエラー" });
  }
});

// ルームID存在チェック
app.get('/api/rooms/:roomId/exists', async (req, res) => {
  const roomId = req.params.roomId;
  const sql = `SELECT COUNT(*) as count FROM rooms WHERE roomid = $1`;

  try {
    const result = await db.query(sql, [roomId]);
    res.json({ exists: result.rows[0].count > 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DBエラー' });
  }
});

// ルーム名取得
app.get('/api/rooms/:roomId/name', async (req, res) => {
  const roomId = req.params.roomId;
  const sql = `SELECT name FROM rooms WHERE roomid = $1`;

  try {
    const result = await db.query(sql, [roomId]);
    if (result.rows.length > 0) {
      res.json({ roomName: result.rows[0].name });
    } else {
      res.status(404).json({ error: 'ルームが見つかりません' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DBエラー' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
