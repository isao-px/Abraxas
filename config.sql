CREATE TABLE imu_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,

    accel_x REAL NOT NULL,
    accel_y REAL NOT NULL,
    accel_z REAL NOT NULL,

    gyro_x REAL NOT NULL,
    gyro_y REAL NOT NULL,
    gyro_z REAL NOT NULL,

    mag_x REAL NOT NULL,
    mag_y REAL NOT NULL,
    mag_z REAL NOT NULL,

    session_id INTAGER NOT NULL);

CREATE TABLE gps_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,

    lat REAL NOT NULL,
    lon REAL NOT NULL,
    p_lat VARCHAR NOT NULL,
    p_lon VARCHAR NOT NULL,

    fix_qual REAL,
    n_satellites INTAGER,

    alt REAL,
    alt_geoid REAL,

    sog_kn REAL NOT NULL,
    sog_kmh REAL,
    cog REAL NOT NULL,

    dilution REAL,
    session_id INTAGER NOT NULL);

CREATE TABLE anemo_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,

    awa INTEGER NOT NULL,
    aws REAL NOT NULL,

    session_id INTAGER NOT NULL);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    start DATETIME NOT NULL,
    stop DATETIME,

    name VARCHAR);