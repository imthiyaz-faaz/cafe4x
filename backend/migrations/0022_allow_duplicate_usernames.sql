-- Migration 0022: Remove UNIQUE constraint on users.user_name while preserving unique email
PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_users_username_nocase;
DROP INDEX IF EXISTS idx_user_username;

CREATE TABLE users_temp (
  id TEXT PRIMARY KEY,
  display_id TEXT UNIQUE,
  name TEXT NOT NULL,
  user_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile_number TEXT,
  password_hash TEXT,
  password TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  qr_token TEXT,
  qr_token_created_at TEXT,
  qr_token_status TEXT DEFAULT 'active',
  perm_token_hash TEXT,
  perm_token_created_at TEXT,
  perm_token_status TEXT DEFAULT 'active'
);

INSERT INTO users_temp (
  id, display_id, name, user_name, email, mobile_number, password_hash, password,
  user_type, created_at, updated_at, qr_token, qr_token_created_at, qr_token_status,
  perm_token_hash, perm_token_created_at, perm_token_status
)
SELECT 
  id, display_id, name, user_name, email, mobile_number, password_hash, password,
  user_type, created_at, updated_at, qr_token, qr_token_created_at, qr_token_status,
  perm_token_hash, perm_token_created_at, perm_token_status
FROM users;

DROP TABLE users;

ALTER TABLE users_temp RENAME TO users;

CREATE INDEX idx_user_username ON users(user_name);
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_display ON users(display_id);
CREATE UNIQUE INDEX idx_users_qr_token ON users(qr_token);
CREATE UNIQUE INDEX idx_users_perm_token_hash ON users(perm_token_hash);
CREATE UNIQUE INDEX idx_users_email_nocase ON users(LOWER(TRIM(email)));

PRAGMA foreign_keys = ON;

