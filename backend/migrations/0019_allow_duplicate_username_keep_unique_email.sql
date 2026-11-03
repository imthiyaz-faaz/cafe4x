-- Migration 0019: Allow duplicate user_name while strictly maintaining unique email

PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_users_username_nocase;

CREATE TABLE IF NOT EXISTS users_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  password TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile_number TEXT,
  user_type TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  qr_token TEXT,
  qr_token_created_at TEXT,
  qr_token_status TEXT DEFAULT 'active',
  perm_token_hash TEXT,
  perm_token_created_at TEXT,
  perm_token_status TEXT DEFAULT 'active',
  display_id TEXT,
  password_hash TEXT
);

INSERT INTO users_new (
  id, name, user_name, password, email, mobile_number, user_type, created_at,
  qr_token, qr_token_created_at, qr_token_status, perm_token_hash,
  perm_token_created_at, perm_token_status, display_id, password_hash
)
SELECT 
  id, name, user_name, password, email, mobile_number, user_type, created_at,
  qr_token, qr_token_created_at, qr_token_status, perm_token_hash,
  perm_token_created_at, perm_token_status, display_id, password_hash
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_qr_token ON users(qr_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_perm_token_hash ON users(perm_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_display ON users(display_id);

PRAGMA foreign_keys = ON;

