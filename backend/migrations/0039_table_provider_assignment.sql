-- ============================================================================
-- Migration: 0039_table_provider_assignment.sql
-- Description:
-- 1. Ensure location_providers table exists with UNIQUE(location_id, provider_id)
-- 2. Backfill location_providers from existing provider_locations and locations
-- 3. Add provider_id to tables and location_tables
-- 4. Backfill tables.provider_id from location's assigned provider where available
-- ============================================================================

-- 1. Location Providers table
CREATE TABLE IF NOT EXISTS location_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  provider_id TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(location_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_loc_prov_loc_id ON location_providers(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_prov_prov_id ON location_providers(provider_id);
CREATE INDEX IF NOT EXISTS idx_loc_prov_org_id ON location_providers(organization_id);

-- Backfill from provider_locations
INSERT OR IGNORE INTO location_providers (organization_id, location_id, provider_id, created_at)
SELECT organization_id, CAST(location_id AS INTEGER), provider_id, created_at
FROM provider_locations
WHERE location_id IS NOT NULL AND provider_id IS NOT NULL;

-- Backfill from locations.assigned_provider_id
INSERT OR IGNORE INTO location_providers (organization_id, location_id, provider_id, created_at)
SELECT organization_id, id, assigned_provider_id, datetime('now')
FROM locations
WHERE assigned_provider_id IS NOT NULL AND assigned_provider_id != '';

-- Add provider_id column to tables
ALTER TABLE tables ADD COLUMN provider_id TEXT;

-- Add provider_id column to location_tables
ALTER TABLE location_tables ADD COLUMN provider_id TEXT;

-- Backfill provider_id on tables from location_providers
UPDATE tables
SET provider_id = (
  SELECT lp.provider_id 
  FROM location_providers lp 
  WHERE lp.location_id = tables.location_id 
  LIMIT 1
)
WHERE provider_id IS NULL OR provider_id = '';

UPDATE location_tables
SET provider_id = (
  SELECT lp.provider_id 
  FROM location_providers lp 
  WHERE lp.location_id = location_tables.location_id 
  LIMIT 1
)
WHERE provider_id IS NULL OR provider_id = '';

CREATE INDEX IF NOT EXISTS idx_tables_provider_id ON tables(provider_id);
CREATE INDEX IF NOT EXISTS idx_loc_tables_provider_id ON location_tables(provider_id);
