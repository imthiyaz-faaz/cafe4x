-- ============================================================================
-- Migration: 0038_location_tables_and_seats_management.sql
-- Description: Comprehensive multi-table management structure:
--   1. Create `location_tables` table
--   2. Create `location_table_seats` table
--   3. Safely backfill existing data from locations / seats / tables
-- ============================================================================

-- 1. Create location_tables table
CREATE TABLE IF NOT EXISTS location_tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  table_name TEXT NOT NULL,
  table_limit INTEGER NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(location_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_loc_tables_loc_id ON location_tables(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_tables_org_id ON location_tables(organization_id);
CREATE INDEX IF NOT EXISTS idx_loc_tables_status ON location_tables(status);

-- 2. Create location_table_seats table
CREATE TABLE IF NOT EXISTS location_table_seats (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  employee_id TEXT,
  employee_name TEXT,
  employee_email TEXT,
  qr_token TEXT UNIQUE,
  order_url TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES location_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(table_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_tbl_id ON location_table_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_loc_id ON location_table_seats(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_org_id ON location_table_seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_status ON location_table_seats(status);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_emp_id ON location_table_seats(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loc_tbl_seats_qr ON location_table_seats(qr_token);

-- 3. Backfill default Table 1 into location_tables for all existing locations
INSERT OR IGNORE INTO location_tables (id, organization_id, location_id, table_name, table_limit, status, created_at, updated_at)
SELECT 
  l.id AS id,
  l.organization_id AS organization_id,
  l.id AS location_id,
  'Table 1' AS table_name,
  MAX(COALESCE(l.total_seats, 8), 1) AS table_limit,
  CASE WHEN LOWER(COALESCE(l.status, 'active')) = 'active' THEN 'active' ELSE 'inactive' END AS status,
  COALESCE(l.created_at, datetime('now')),
  COALESCE(l.updated_at, datetime('now'))
FROM locations l;

-- Also copy from existing `tables` table if it had custom tables
INSERT OR IGNORE INTO location_tables (id, organization_id, location_id, table_name, table_limit, status, created_at, updated_at)
SELECT
  t.id AS id,
  COALESCE(l.organization_id, 'org_fts_local') AS organization_id,
  t.location_id AS location_id,
  t.name AS table_name,
  COALESCE(t.seat_limit, 8) AS table_limit,
  CASE WHEN t.is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
  COALESCE(t.created_at, datetime('now')),
  COALESCE(t.updated_at, datetime('now'))
FROM tables t
JOIN locations l ON t.location_id = l.id;

-- 4. Backfill existing seats into location_table_seats
INSERT OR IGNORE INTO location_table_seats (
  id, organization_id, location_id, table_id, seat_number, seat_identifier, status,
  employee_id, employee_name, employee_email, qr_token, order_url, created_at, updated_at
)
SELECT
  s.id AS id,
  s.organization_id AS organization_id,
  CAST(s.location_id AS INTEGER) AS location_id,
  COALESCE(s.table_id, CAST(s.location_id AS INTEGER)) AS table_id,
  COALESCE(CAST(s.number AS INTEGER), 1) AS seat_number,
  'SEAT-' || COALESCE(s.number, '1') AS seat_identifier,
  COALESCE(s.status, 'available') AS status,
  s.employee_id,
  COALESCE(s.employee_name, s.employee) AS employee_name,
  s.employee_email,
  s.qr_token,
  s.order_url,
  COALESCE(s.created_at, datetime('now')),
  COALESCE(s.updated_at, datetime('now'))
FROM seats s;

