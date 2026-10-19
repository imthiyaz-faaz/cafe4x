-- Migration: 0011_add_ordering_sessions.sql
-- Description:
-- 1. Add permanent QR credential columns (SHA-256 hash of raw permanent token) to users table
--    These serve as the permanent, immutable QR code entry point for each employee.
--    The raw permanent token is only returned at provisioning/regeneration time; only its
--    SHA-256 hex hash is stored in the database.
-- 2. Create ordering_sessions table for temporary, expiring ordering tokens.
--    A temporary session is created each time a valid permanent QR link is scanned.
--    Session tokens expire after 30 minutes. Sessions can also be explicitly revoked.

-- 1. Add permanent QR credential hash columns to users
-- NOTE: qr_token already exists from migration 0010 and stores the raw permanent token.
-- We add a parallel perm_token_hash column for the hashed version going forward.
-- The existing qr_token column is kept for backward compatibility with the existing UI.
ALTER TABLE users ADD COLUMN perm_token_hash TEXT;
ALTER TABLE users ADD COLUMN perm_token_created_at TEXT;
ALTER TABLE users ADD COLUMN perm_token_status TEXT DEFAULT 'active'; -- 'active' | 'revoked'

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_perm_token_hash ON users(perm_token_hash);

-- 2. Temporary Ordering Sessions Table
CREATE TABLE IF NOT EXISTS ordering_sessions (
  id TEXT PRIMARY KEY,
  temp_token_hash TEXT NOT NULL UNIQUE,        -- SHA-256 hex hash of raw temporary token
  employee_id TEXT NOT NULL,                    -- FK to users.id
  organization_id TEXT NOT NULL,               -- FK to organizations.id
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,                     -- ISO timestamp: created_at + 30 minutes
  revoked_at TEXT,                              -- NULL if not revoked
  status TEXT NOT NULL DEFAULT 'active',        -- 'active' | 'expired' | 'revoked' | 'used'
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_temp_token_hash ON ordering_sessions(temp_token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_employee ON ordering_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON ordering_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON ordering_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON ordering_sessions(expires_at);
