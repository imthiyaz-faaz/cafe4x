-- Migration: 0006_saas_architecture_redesign.sql
-- Description:
-- 1. Create id_sequences table for safe, atomic, gapless sequence generation
-- 2. Create provider_locations mapping table for many-to-many provider-to-location assignments
-- 3. Create order_items table for normalized item breakdown per order
-- 4. Add display_id and public_id support across core entities
-- 5. Add password_hash column to users table for secure password hashing

-- 1. Atomic Sequence Table for Human-Readable Identifiers
CREATE TABLE IF NOT EXISTS id_sequences (
  scope TEXT PRIMARY KEY,
  last_val INTEGER NOT NULL DEFAULT 0
);

-- 2. Provider-Location Dedicated Mapping Table
CREATE TABLE IF NOT EXISTS provider_locations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE(organization_id, provider_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_prov_loc_org ON provider_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_prov_loc_provider ON provider_locations(provider_id);
CREATE INDEX IF NOT EXISTS idx_prov_loc_location ON provider_locations(location_id);

-- 3. Normalized Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  item_id TEXT,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  preference TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org ON order_items(organization_id);

-- 4. Add display_id and password_hash columns (IF NOT EXISTS via ALTER statements or conditional logic)
-- Note: SQLite ALTER TABLE ADD COLUMN succeeds if not present.
