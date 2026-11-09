-- ============================================================================
-- Migration: 0033_fix_seats_organization_uniqueness.sql
-- Description: Enforce multi-tenant organization+location scoped uniqueness
--              for seats, preserving globally unique primary keys (seats.id),
--              and replacing legacy constraints with:
--                UNIQUE(organization_id, location_id, display_id)
--                UNIQUE(organization_id, location_id, number)
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- Step 1: Ensure display_id is populated for all existing seats
UPDATE seats
SET display_id = COALESCE(display_id, id)
WHERE display_id IS NULL OR display_id = '';

-- Step 2: Create new seats table with composite organization+location uniqueness
CREATE TABLE seats_new (
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

-- Step 3: Copy all existing seat data safely
INSERT INTO seats_new (
  id, display_id, location_id, organization_id, number,
  employee, employee_name, employee_email, employee_id,
  order_url, created_at, updated_at, qr_token
)
SELECT
  id, display_id, location_id, organization_id, number,
  employee, employee_name, employee_email, employee_id,
  order_url, created_at, updated_at, qr_token
FROM seats;

-- Step 4: Drop old seats table and rename seats_new
DROP TABLE seats;
ALTER TABLE seats_new RENAME TO seats;

-- Step 5: Recreate indexes for fast organization and location lookups
CREATE INDEX idx_seats_location ON seats(location_id);
CREATE INDEX idx_seats_org ON seats(organization_id);
CREATE INDEX idx_seats_display ON seats(display_id);
CREATE INDEX idx_seats_employee_id ON seats(employee_id);
CREATE INDEX idx_seats_employee_email ON seats(employee_email);
CREATE UNIQUE INDEX idx_seats_qr_token ON seats(qr_token);
CREATE UNIQUE INDEX idx_seats_org_loc_display_id_nocase ON seats(organization_id, location_id, LOWER(TRIM(display_id)));
CREATE UNIQUE INDEX idx_seats_org_loc_number ON seats(organization_id, location_id, number);

PRAGMA foreign_keys = ON;

