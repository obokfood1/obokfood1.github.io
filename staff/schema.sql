CREATE TABLE IF NOT EXISTS shelf_records (
 id TEXT PRIMARY KEY, username TEXT NOT NULL, user_name TEXT NOT NULL,
 store TEXT NOT NULL, branch TEXT NOT NULL, category TEXT NOT NULL,
 date TEXT NOT NULL, layout TEXT NOT NULL, items TEXT NOT NULL,
 analysis TEXT NOT NULL, photo_keys TEXT NOT NULL, memo TEXT NOT NULL,
 total INTEGER NOT NULL, obok_share REAL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS shelf_records_user_date ON shelf_records(username,created_at DESC);

-- Additional table is also created safely by the account API on first use.
CREATE TABLE IF NOT EXISTS staff_accounts (
 username TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL,
 disabled INTEGER NOT NULL DEFAULT 0, must_change INTEGER NOT NULL DEFAULT 1,
 auth_version INTEGER NOT NULL DEFAULT 1, temporary_expires TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
