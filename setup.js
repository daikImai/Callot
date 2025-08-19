const db = require('./db');

async function createTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      roomid VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS nicknames (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      room_id INTEGER REFERENCES rooms(id)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS times (
      id SERIAL PRIMARY KEY,
      date VARCHAR(255) NOT NULL,
      start_time VARCHAR(255),
      end_time VARCHAR(255),
      nickname_id INTEGER REFERENCES nicknames(id)
    );
  `);

  console.log("Tables created!");
  process.exit();
}

createTables().catch(err => {
  console.error(err);
  process.exit(1);
});
