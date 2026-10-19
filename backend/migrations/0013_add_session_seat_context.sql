-- Migration: 0013_add_session_seat_context.sql
-- Description:
-- Extend ordering_sessions table to store authorized seat and location context.
-- This allows both assigned employees and unassigned seat visitors to obtain
-- temporary cryptographically secured ordering sessions, bound to the verified
-- organization, location, and seat.

ALTER TABLE ordering_sessions ADD COLUMN seat_id TEXT;
ALTER TABLE ordering_sessions ADD COLUMN seat_number TEXT;
ALTER TABLE ordering_sessions ADD COLUMN location_id TEXT;
ALTER TABLE ordering_sessions ADD COLUMN location_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_seat ON ordering_sessions(seat_id);
CREATE INDEX IF NOT EXISTS idx_sessions_location ON ordering_sessions(location_id);
