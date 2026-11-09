-- Migration 0030: Enforce case-insensitive unique location name per organization
-- Two different organizations can have locations with identical names (e.g. 'office'),
-- but within the same organization, location names must be unique.

-- Step 1: Resolve existing duplicate location names within the same organization by appending display_id suffix
UPDATE locations
SET name = name || ' (' || COALESCE(display_id, SUBSTR(id, -4)) || ')'
WHERE id IN (
  SELECT l1.id
  FROM locations l1
  JOIN locations l2 
    ON l1.organization_id = l2.organization_id 
   AND LOWER(TRIM(l1.name)) = LOWER(TRIM(l2.name)) 
   AND l1.id > l2.id
);

-- Step 2: Create composite unique index on (organization_id, LOWER(TRIM(name)))
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_org_name_nocase 
ON locations(organization_id, LOWER(TRIM(name)));

