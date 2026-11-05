-- Migration: 0026_location_wise_seat_numbers.sql
-- Description:
-- Implement location-wise independent seat numbering:
-- 1. Migrate existing seats in 'office' from SEA-000001..12 to OFFICE-0001..0012.
-- 2. Migrate existing seats in 'room' (e.g. SEA-000013) to ROOM-0001.
-- 3. Update employee_seat_assignments foreign keys / references.
-- 4. Recreate seats table with PRIMARY KEY (location_id, id) to allow multiple organizations to have identical seat numbers (e.g. OFFICE-0001).
-- 5. Recreate employee_seat_assignments table with UNIQUE (location_id, seat_id).
-- 6. Initialize location-scoped sequence in id_sequences for all locations.

-- Step 1: Update existing seats in 'office' locations
UPDATE seats
SET id = 'OFFICE-0001', display_id = 'OFFICE-0001'
WHERE id = 'SEA-000001' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0002', display_id = 'OFFICE-0002'
WHERE id = 'SEA-000002' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0003', display_id = 'OFFICE-0003'
WHERE id = 'SEA-000003' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0004', display_id = 'OFFICE-0004'
WHERE id = 'SEA-000004' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0005', display_id = 'OFFICE-0005'
WHERE id = 'SEA-000005' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0006', display_id = 'OFFICE-0006'
WHERE id = 'SEA-000006' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0007', display_id = 'OFFICE-0007'
WHERE id = 'SEA-000007' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0008', display_id = 'OFFICE-0008'
WHERE id = 'SEA-000008' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0009', display_id = 'OFFICE-0009'
WHERE id = 'SEA-000009' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0010', display_id = 'OFFICE-0010'
WHERE id = 'SEA-000010' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0011', display_id = 'OFFICE-0011'
WHERE id = 'SEA-000011' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

UPDATE seats
SET id = 'OFFICE-0012', display_id = 'OFFICE-0012'
WHERE id = 'SEA-000012' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'office');

-- Step 2: Update existing seats in 'room' locations (e.g. SEA-000013 -> ROOM-0001)
UPDATE seats
SET id = 'ROOM-0001', display_id = 'ROOM-0001'
WHERE id = 'SEA-000013' AND location_id IN (SELECT id FROM locations WHERE LOWER(name) = 'room');

-- Also catch any remaining SEA-000013 regardless of location
UPDATE seats
SET id = 'ROOM-0001', display_id = 'ROOM-0001'
WHERE id = 'SEA-000013';

-- Step 3: Update employee_seat_assignments matching old seat IDs
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0001' WHERE seat_id = 'SEA-000001';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0002' WHERE seat_id = 'SEA-000002';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0003' WHERE seat_id = 'SEA-000003';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0004' WHERE seat_id = 'SEA-000004';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0005' WHERE seat_id = 'SEA-000005';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0006' WHERE seat_id = 'SEA-000006';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0007' WHERE seat_id = 'SEA-000007';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0008' WHERE seat_id = 'SEA-000008';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0009' WHERE seat_id = 'SEA-000009';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0010' WHERE seat_id = 'SEA-000010';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0011' WHERE seat_id = 'SEA-000011';
UPDATE employee_seat_assignments SET seat_id = 'OFFICE-0012' WHERE seat_id = 'SEA-000012';
UPDATE employee_seat_assignments SET seat_id = 'ROOM-0001' WHERE seat_id = 'SEA-000013';

-- Step 4: Recreate seats table with PRIMARY KEY (location_id, id)
CREATE TABLE IF NOT EXISTS seats_new (
  id TEXT NOT NULL,
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
  PRIMARY KEY (location_id, id),
  UNIQUE (location_id, number)
);

INSERT INTO seats_new (id, display_id, location_id, organization_id, number, employee, employee_name, employee_email, employee_id, order_url, created_at, updated_at)
SELECT id, display_id, location_id, organization_id, number, employee, employee_name, employee_email, employee_id, order_url, created_at, updated_at
FROM seats;

DROP TABLE seats;
ALTER TABLE seats_new RENAME TO seats;

CREATE INDEX IF NOT EXISTS idx_seats_location ON seats(location_id);
CREATE INDEX IF NOT EXISTS idx_seats_org ON seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_seats_display ON seats(display_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_id ON seats(employee_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_email ON seats(employee_email);

-- Step 5: Recreate employee_seat_assignments table with UNIQUE(location_id, seat_id)
CREATE TABLE IF NOT EXISTS employee_seat_assignments_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location_id, seat_id),
  UNIQUE(organization_id, employee_id)
);

INSERT OR IGNORE INTO employee_seat_assignments_new (id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at)
SELECT id, organization_id, location_id, seat_id, employee_id, assigned_at, created_at, updated_at
FROM employee_seat_assignments;

DROP TABLE employee_seat_assignments;
ALTER TABLE employee_seat_assignments_new RENAME TO employee_seat_assignments;

CREATE INDEX IF NOT EXISTS idx_seat_assignments_org ON employee_seat_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_loc ON employee_seat_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_seat ON employee_seat_assignments(seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_emp ON employee_seat_assignments(employee_id);

-- Step 6: Initialize sequences in id_sequences for all locations
INSERT INTO id_sequences (scope, last_val)
SELECT 'SEAT_LOC_' || id, 12
FROM locations
WHERE LOWER(name) = 'office'
ON CONFLICT(scope) DO UPDATE SET last_val = MAX(last_val, 12);

INSERT INTO id_sequences (scope, last_val)
SELECT 'SEAT_LOC_' || id, 1
FROM locations
WHERE LOWER(name) = 'room'
ON CONFLICT(scope) DO UPDATE SET last_val = MAX(last_val, 1);

INSERT INTO id_sequences (scope, last_val)
SELECT 'SEAT_LOC_' || location_id, COUNT(*)
FROM seats
GROUP BY location_id
ON CONFLICT(scope) DO UPDATE SET last_val = MAX(last_val, excluded.last_val);

