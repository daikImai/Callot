const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// データベースの読み込み
const db = require('./callot.db');

const app = express();
const PORT = process.env.PORT || 3000;

// CORSとJSONボディパース
app.use(cors());
app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'public')));

// APIルーティングの例（詳細は後で）
app.get('/api/test', (req, res) => {
  res.json({ message: 'API動いてます' });
});

// 最後にHTMLを返す（SPA用）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
