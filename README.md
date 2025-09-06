# Callot
日程調整アプリ

## Overview
このアプリは、複数人での日程調整を手助けするWebアプリです。  
誰がどの日のどの時間帯で空いており、それがどこの時間帯で被っているかを一目で確認することができます。

## Demo
- URL (Render): https://callot.onrender.com
※ This Render DB is currently suspended.

This project also has a Firebase version implemented without a custom Node.js backend.

- URL (Firebase): https://callot-di2503.web.app
- GitHub: https://github.com/daikImai/Callot_fb

## Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: PostgreSQL
- Deployment: Render

## Features
- 投票の作成・IDによる参加
- 日付のみ/日付と時間 の2種類の調整方式
- ニックネームを使用した日時の投票・閲覧

## Setup in Local
### 1. Install necessary softwares
- Node.js
- PostgreSQL
### 2. Clone the repository
```bash
git clone https://github.com/daikImai/Callot.git
cd Callot
```
### 3. Install dependencies
```bash
npm install
```
### 4. Create PostgreSQL database

ローカルのPostgreSQLでターミナルを開き、以下を実行:
```sql
-- データベースを作成
CREATE DATABASE callot_db;

-- 開発用ユーザを作成
CREATE USER callot_user WITH PASSWORD 'password';

-- 作成したユーザに権限を付与
GRANT ALL PRIVILEGES ON DATABASE callot_db TO callot_user;

-- callot_db に接続
\c callot_db

-- public スキーマの権限を付与
GRANT ALL ON SCHEMA public TO callot_user;
ALTER SCHEMA public OWNER TO callot_user;
```
### 5. Setup environment variables

.env ファイルを作成して以下を記入:
```bash
DATABASE_URL=postgres://callot_user:password@localhost:5432/callot_db
PORT=3000
```
### 6. Setup database
```bash
node setup.js
```
### 7. Start the server
```bash
npm start
```
Access on Browser: http://localhost:3000

