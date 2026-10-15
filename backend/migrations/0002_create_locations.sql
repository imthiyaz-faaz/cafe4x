-- Locations Table
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
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
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_provider_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Locations
CREATE INDEX IF NOT EXISTS idx_loc_org ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_loc_short_code ON locations(short_code);
CREATE INDEX IF NOT EXISTS idx_loc_provider ON locations(assigned_provider_id);
