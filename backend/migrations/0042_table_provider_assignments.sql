-- Migration: 0042_table_provider_assignments.sql
-- Description:
-- 1. Create table_provider_assignments mapping table:
--    id (INTEGER PRIMARY KEY AUTOINCREMENT)
--    table_id (INTEGER NOT NULL UNIQUE)
--    location_provider_id (INTEGER NOT NULL)
--    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
--    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
--    FOREIGN KEY (table_id) REFERENCES location_tables(id) ON DELETE CASCADE
--    FOREIGN KEY (location_provider_id) REFERENCES location_providers(id) ON DELETE CASCADE
--    UNIQUE(table_id) to enforce one provider per table.
-- 2. Populate initial records from existing location_tables and location_providers where provider_id matches.

CREATE TABLE IF NOT EXISTS table_provider_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL UNIQUE,
  location_provider_id INTEGER NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES location_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (location_provider_id) REFERENCES location_providers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tbl_prov_assign_tbl_id ON table_provider_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_tbl_prov_assign_loc_prov_id ON table_provider_assignments(location_provider_id);

-- Seed existing provider assignments from location_tables and location_providers
INSERT OR IGNORE INTO table_provider_assignments (table_id, location_provider_id, created_at, updated_at)
SELECT 
  lt.id AS table_id,
  lp.id AS location_provider_id,
  datetime('now'),
  datetime('now')
FROM location_tables lt
JOIN location_providers lp 
  ON lt.location_id = lp.location_id 
  AND lt.provider_id = lp.provider_id
WHERE lt.provider_id IS NOT NULL AND lt.provider_id != '';

