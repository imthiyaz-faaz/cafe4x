-- ============================================================================
-- Migration: 0036_add_tables_and_multi_table_seats.sql
-- Description: Implement Multi-Table support per location:
--              1. Add table_limit column to locations (default 5)
--              2. Create new tables table:
--                 - id INTEGER PRIMARY KEY AUTOINCREMENT
--                 - location_id INTEGER NOT NULL
--                 - name TEXT NOT NULL
--                 - seat_limit INTEGER NOT NULL
--                 - is_active INTEGER DEFAULT 1
--                 - created_at DATETIME DEFAULT CURRENT_TIMESTAMP
--                 - updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
--                 - UNIQUE(location_id, name)
--              3. Restructure seats table to link to table_id:
--                 - table_id INTEGER NOT NULL
--                 - number INTEGER NOT NULL (1..N per table)
--                 - status TEXT DEFAULT 'available'
--                 - UNIQUE(table_id, number)
--              4. Safely backfill existing locations into Table 1 and migrate existing seats
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- Step 1: Add table_limit column to locations if not present
ALTER TABLE locations ADD COLUMN table_limit INTEGER NOT NULL DEFAULT 5;

-- Step 2: Create new `tables` table
CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  seat_limit INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE(location_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tables_location_id ON tables(location_id);
CREATE INDEX IF NOT EXISTS idx_tables_is_active ON tables(is_active);

-- Step 3: Populate default "Table 1" for any existing location that has seats or exists
INSERT OR IGNORE INTO tables (id, location_id, name, seat_limit, is_active, created_at, updated_at)
SELECT 
  l.id AS id, -- Deterministic ID for initial Table 1 per location
  l.id AS location_id,
  'Table 1' AS name,
  MAX(COALESCE(l.total_seats, 12), COALESCE((SELECT COUNT(*) FROM seats s WHERE s.location_id = CAST(l.id AS TEXT) OR s.location_id = l.id), 0), 1) AS seat_limit,
  CASE WHEN l.status = 'Active' THEN 1 ELSE 0 END AS is_active,
  l.created_at,
  l.updated_at
FROM locations l;

-- Step 4: Create new seats_v3 table supporting table_id, independent seat numbers per table
CREATE TABLE IF NOT EXISTS seats_v3 (
  id TEXT PRIMARY KEY,
  table_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  organization_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  employee_id TEXT,
  employee TEXT,
  employee_name TEXT,
  employee_email TEXT,
  qr_token TEXT UNIQUE,
  order_url TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(table_id, number)
);

-- Step 5: Migrate existing seats to seats_v3, linking to the newly created Table 1 for their location
INSERT OR IGNORE INTO seats_v3 (
  id,
  table_id,
  location_id,
  organization_id,
  number,
  status,
  employee_id,
  employee,
  employee_name,
  employee_email,
  qr_token,
  order_url,
  created_at,
  updated_at
)
SELECT
  s.id,
  -- Link to Table 1 of that location
  COALESCE(t.id, CAST(s.location_id AS INTEGER)) AS table_id,
  CAST(s.location_id AS INTEGER) AS location_id,
  s.organization_id,
  -- Normalize seat number to integer 1..N
  COALESCE(
    CASE 
      WHEN CAST(s.number AS INTEGER) > 0 THEN CAST(s.number AS INTEGER)
      ELSE NULL
    END,
    (
      SELECT COUNT(*) 
      FROM seats sub 
      WHERE sub.location_id = s.location_id AND sub.rowid <= s.rowid
    ),
    1
  ) AS number,
  -- Status: occupied if employee assigned, otherwise available
  CASE 
    WHEN s.employee_id IS NOT NULL OR s.employee_email IS NOT NULL OR s.employee IS NOT NULL THEN 'occupied'
    ELSE 'available'
  END AS status,
  s.employee_id,
  s.employee,
  s.employee_name,
  s.employee_email,
  s.qr_token,
  s.order_url,
  s.created_at,
  s.updated_at
FROM seats s
LEFT JOIN tables t ON t.location_id = CAST(s.location_id AS INTEGER) AND t.name = 'Table 1';

-- Step 6: Replace old seats with seats_v3
DROP TABLE seats;
ALTER TABLE seats_v3 RENAME TO seats;

-- Step 7: Create indexes on seats
CREATE INDEX IF NOT EXISTS idx_seats_table_id ON seats(table_id);
CREATE INDEX IF NOT EXISTS idx_seats_location_id ON seats(location_id);
CREATE INDEX IF NOT EXISTS idx_seats_organization_id ON seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_id ON seats(employee_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);

PRAGMA foreign_keys = ON;

