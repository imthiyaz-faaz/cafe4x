-- Migration: 0025_employee_seat_assignments.sql
-- Description:
-- Create employee_seat_assignments table to manage active seat assignments.
-- Enforces:
-- 1. One seat can only have one active assignment (UNIQUE(seat_id)).
-- 2. One employee cannot be assigned to multiple seats in the same organization (UNIQUE(organization_id, employee_id)).
-- 3. Permanent tracking with cascade on deletion of organization, location, seat, or user.

CREATE TABLE IF NOT EXISTS employee_seat_assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(seat_id),
  UNIQUE(organization_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_seat_assignments_org ON employee_seat_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_loc ON employee_seat_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_seat ON employee_seat_assignments(seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_emp ON employee_seat_assignments(employee_id);

-- Initialize sequence for EMPLOYEE_SEAT_ASSIGNMENTS in id_sequences
INSERT INTO id_sequences (scope, last_val) VALUES ('EMPLOYEE_SEAT_ASSIGNMENTS', 0)
ON CONFLICT(scope) DO NOTHING;

-- Backfill any existing assigned seats into employee_seat_assignments
INSERT OR IGNORE INTO employee_seat_assignments (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
SELECT 
  'ESA-' || substr('00000' || row_number() over (order by created_at), -6),
  organization_id,
  location_id,
  id,
  employee_id,
  COALESCE(updated_at, datetime('now')),
  COALESCE(created_at, datetime('now')),
  COALESCE(updated_at, datetime('now'))
FROM seats
WHERE employee_id IS NOT NULL AND employee_id != '';

