DROP TABLE IF EXISTS rooms;

CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomid TEXT UNIQUE,
    name TEXT
);

DROP TABLE IF EXISTS nicknames;

CREATE TABLE nicknames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    room_id INTEGER,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

DROP TABLE IF EXISTS times; 

CREATE TABLE times (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    nickname_id INTEGER,
    FOREIGN KEY (nickname_id) REFERENCES nicknames(id)
);
