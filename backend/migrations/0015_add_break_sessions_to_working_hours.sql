-- Migration: 0015_add_break_sessions_to_working_hours.sql
-- Description: Ensures working_hours table exists and includes break_sessions_json column

CREATE TABLE IF NOT EXISTS working_hours (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL UNIQUE,
  open_time TEXT NOT NULL DEFAULT '08:00',
  close_time TEXT NOT NULL DEFAULT '20:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  is_emergency_closed INTEGER NOT NULL DEFAULT 0,
  break_sessions_json TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_working_hours_org ON working_hours(organization_id);
