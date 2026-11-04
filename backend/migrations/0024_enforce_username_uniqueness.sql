-- Migration 0024: Enforce strict UNIQUE constraint on users(user_name COLLATE NOCASE)
PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_users_username_lower;
DROP INDEX IF EXISTS idx_user_username;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase ON users(user_name COLLATE NOCASE);

PRAGMA foreign_keys = ON;

