-- ============================================================================
-- Migration: 0035_restructure_seats_global_id_format.sql
-- Description: Restructure seats table to support globally unique, human-readable Seat IDs:
--              Format: ORG-000001-LOC-000001-SEAT-001
--              - Organization ID: globally identifies the organization (e.g. ORG-000001)
--              - Location ID: globally identifies the location (e.g. LOC-000001)
--              - Seat Number: sequential seat number within that location (e.g. SEAT-001)
--              - Friendly display identifier: <LOCATION_PREFIX>-<SEAT_NUMBER_PADDED> (e.g. OFFICE-001)
--              - Scoped independent sequence per location, deleted numbers not reused
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- Step 1: Create new seats table with composite organization+location uniqueness
CREATE TABLE IF NOT EXISTS seats_v2 (
  id TEXT PRIMARY KEY,
  display_id TEXT,
  location_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  number TEXT NOT NULL,
  employee TEXT,
  employee_name TEXT,
  employee_email TEXT,
  employee_id TEXT,
  order_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  qr_token TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE(organization_id, location_id, display_id),
  UNIQUE(organization_id, location_id, number)
);

-- Step 2: Migrate existing records safely into seats_v2 with standard ORG-XXXXXX-LOC-XXXXXX-SEAT-XXX IDs
-- For existing rows, normalize org_id, loc_id, and sequential seat number:
INSERT OR IGNORE INTO seats_v2 (
  id,
  display_id,
  location_id,
  organization_id,
  number,
  employee,
  employee_name,
  employee_email,
  employee_id,
  order_url,
  created_at,
  updated_at,
  qr_token
)
SELECT
  -- Compute globally unique ID: ORG-000001-LOC-000001-SEAT-001
  COALESCE(
    CASE 
      WHEN s.id LIKE 'ORG-%-LOC-%-SEAT-%' THEN s.id
      ELSE (
        printf('ORG-%06d', CAST(REPLACE(s.organization_id, 'ORG-', '') AS INTEGER)) || '-' ||
        printf('LOC-%06d', CAST(s.location_id AS INTEGER)) || '-' ||
        printf('SEAT-%03d', CAST(s.number AS INTEGER))
      )
    END,
    s.id
  ) AS id,
  -- Friendly display_id: e.g. OFFICE-001
  COALESCE(
    CASE
      WHEN s.display_id LIKE '%-___' OR s.display_id LIKE '%-__' OR s.display_id LIKE '%-_' THEN (
        UPPER(SUBSTR(s.display_id, 1, INSTR(s.display_id, '-') - 1)) || '-' ||
        printf('%03d', CAST(s.number AS INTEGER))
      )
      ELSE (
        COALESCE(
          (SELECT UPPER(REPLACE(TRIM(name), ' ', '-')) FROM locations WHERE id = s.location_id),
          'OFFICE'
        ) || '-' || printf('%03d', CAST(s.number AS INTEGER))
      )
    END,
    s.display_id,
    printf('OFFICE-%03d', CAST(s.number AS INTEGER))
  ) AS display_id,
  CAST(s.location_id AS TEXT) AS location_id,
  s.organization_id,
  s.number,
  s.employee,
  s.employee_name,
  s.employee_email,
  s.employee_id,
  s.order_url,
  s.created_at,
  s.updated_at,
  s.qr_token
FROM seats s;

-- Step 3: Update employee_seat_assignments foreign key references if any
UPDATE employee_seat_assignments
SET seat_id = (
  SELECT sv2.id 
  FROM seats_v2 sv2 
  WHERE sv2.organization_id = employee_seat_assignments.organization_id
    AND sv2.location_id = employee_seat_assignments.location_id
    AND (
      sv2.id = employee_seat_assignments.seat_id OR
      sv2.number = employee_seat_assignments.seat_id OR
      sv2.display_id = employee_seat_assignments.seat_id
    )
)
WHERE seat_id IN (SELECT id FROM seats);

-- Step 4: Update orders foreign key references if any
UPDATE orders
SET seat_id = (
  SELECT sv2.id 
  FROM seats_v2 sv2 
  WHERE sv2.organization_id = orders.organization_id
    AND sv2.location_id = orders.location_id
    AND (
      sv2.id = orders.seat_id OR
      sv2.number = orders.seat OR
      sv2.display_id = orders.seat_id OR
      sv2.display_id = orders.seat
    )
)
WHERE seat_id IS NOT NULL AND seat_id != '';

-- Step 5: Replace old seats table with seats_v2
DROP TABLE seats;
ALTER TABLE seats_v2 RENAME TO seats;

-- Step 6: Recreate indexes and constraints
CREATE INDEX IF NOT EXISTS idx_seats_location ON seats(location_id);
CREATE INDEX IF NOT EXISTS idx_seats_org ON seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_seats_display ON seats(display_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_id ON seats(employee_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_email ON seats(employee_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_qr_token ON seats(qr_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_display_id_nocase ON seats(organization_id, location_id, LOWER(TRIM(display_id)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_number ON seats(organization_id, location_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_employee_email_nocase
ON seats (
  organization_id,
  location_id,
  LOWER(TRIM(employee_email))
)
WHERE employee_email IS NOT NULL AND TRIM(employee_email) != '';

-- Step 7: Initialize/Synchronize location sequences in id_sequences for existing seats
INSERT INTO id_sequences (scope, last_val)
SELECT 
  'SEAT_SEQ_' || s.organization_id || '_LOC_' || s.location_id AS scope,
  MAX(CAST(s.number AS INTEGER)) AS last_val
FROM seats s
GROUP BY s.organization_id, s.location_id
ON CONFLICT(scope) DO UPDATE SET last_val = MAX(last_val, excluded.last_val);

PRAGMA foreign_keys = ON;

