-- Migration 0031: Location-scoped seat numbering and uniqueness constraints
-- 1. Ensure seats.id has globally unique primary keys.
-- 2. Backfill display_id if null or empty.
-- 3. Enforce location-scoped uniqueness constraints:
--    - UNIQUE(location_id, number)
--    - UNIQUE(location_id, LOWER(TRIM(display_id)))
-- 4. Fast composite lookup index on (location_id, display_id).

-- Step 1: Backfill display_id where missing
UPDATE seats
SET display_id = id
WHERE display_id IS NULL OR display_id = '';

-- Step 2: Ensure unique index on (location_id, number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_location_number
ON seats(location_id, number);

-- Step 3: Ensure unique index on (organization_id, location_id, LOWER(TRIM(display_id)))
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_display_id_nocase
ON seats(organization_id, location_id, LOWER(TRIM(display_id)));

-- Step 4: Ensure unique index on (organization_id, location_id, number)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_number
ON seats(organization_id, location_id, number);

-- Also maintain location-scoped indexes for single location queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_location_number
ON seats(location_id, number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_location_display_id_nocase
ON seats(location_id, LOWER(TRIM(display_id)));

-- Step 5: Initialize global sequence counter for LOCATIONS starting above any legacy IDs
INSERT INTO id_sequences (scope, last_val) VALUES ('LOCATIONS', 36)
ON CONFLICT(scope) DO NOTHING;
