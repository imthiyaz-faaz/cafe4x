-- ============================================================================
-- Migration: 0032_locations_integer_pk_autoincrement.sql
-- Description: Convert locations.id to INTEGER PRIMARY KEY AUTOINCREMENT
--              Assign sequential numeric IDs (1, 2, 3...) to existing locations
--              Update all dependent foreign keys and references:
--                - provider_locations.location_id
--                - seats.location_id
--                - employee_seat_assignments.location_id
--                - orders.location_id
--                - ordering_sessions.location_id (if present)
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- Step 1: Create a temporary mapping table to assign sequential integers 1, 2, 3...
CREATE TABLE IF NOT EXISTS _location_id_map (
  new_id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_id TEXT
);

-- Insert existing location IDs in deterministic order (by rowid/created_at)
-- If any row has a NULL or empty id, we assign it a rowid-based fallback
INSERT INTO _location_id_map (old_id)
SELECT COALESCE(id, 'row_' || rowid) FROM locations ORDER BY rowid ASC;

-- Step 2: Create new locations table with INTEGER PRIMARY KEY AUTOINCREMENT
CREATE TABLE locations_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT,
  short_code TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  total_seats INTEGER NOT NULL DEFAULT 12,
  image TEXT,
  assigned_provider_id TEXT,
  assigned_provider_name TEXT,
  assigned_provider_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  display_id TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_provider_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Step 3: Populate locations_new with existing data and newly mapped numeric IDs
INSERT INTO locations_new (
  id, organization_id, short_code, name, status, total_seats, image,
  assigned_provider_id, assigned_provider_name, assigned_provider_email,
  created_at, updated_at, display_id
)
SELECT
  m.new_id,
  l.organization_id,
  l.short_code,
  l.name,
  l.status,
  l.total_seats,
  l.image,
  l.assigned_provider_id,
  l.assigned_provider_name,
  l.assigned_provider_email,
  l.created_at,
  l.updated_at,
  CAST(m.new_id AS TEXT)
FROM locations l
JOIN _location_id_map m ON COALESCE(l.id, 'row_' || l.rowid) = m.old_id;

-- Step 4: Update dependent tables with the new numeric location_id
-- 4.1. provider_locations
UPDATE provider_locations
SET location_id = CAST((SELECT m.new_id FROM _location_id_map m WHERE m.old_id = provider_locations.location_id) AS TEXT)
WHERE location_id IN (SELECT old_id FROM _location_id_map);

-- 4.2. seats
UPDATE seats
SET location_id = CAST((SELECT m.new_id FROM _location_id_map m WHERE m.old_id = seats.location_id) AS TEXT)
WHERE location_id IN (SELECT old_id FROM _location_id_map);

-- 4.3. employee_seat_assignments
UPDATE employee_seat_assignments
SET location_id = CAST((SELECT m.new_id FROM _location_id_map m WHERE m.old_id = employee_seat_assignments.location_id) AS TEXT)
WHERE location_id IN (SELECT old_id FROM _location_id_map);

-- 4.4. orders
UPDATE orders
SET location_id = CAST((SELECT m.new_id FROM _location_id_map m WHERE m.old_id = orders.location_id) AS TEXT)
WHERE location_id IN (SELECT old_id FROM _location_id_map);

-- Step 5: Replace old locations table with new locations table
DROP TABLE locations;
ALTER TABLE locations_new RENAME TO locations;

-- Step 6: Recreate indexes on locations
CREATE INDEX idx_loc_org ON locations(organization_id);
CREATE INDEX idx_loc_short_code ON locations(short_code);
CREATE INDEX idx_loc_provider ON locations(assigned_provider_id);
CREATE INDEX idx_loc_display ON locations(display_id);
CREATE UNIQUE INDEX idx_locations_org_name_nocase ON locations(organization_id, LOWER(TRIM(name)));

-- Step 7: Clean up temporary mapping table
DROP TABLE _location_id_map;

PRAGMA foreign_keys = ON;
