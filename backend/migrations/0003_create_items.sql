-- Items Table
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  short_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  preference TEXT,
  amount REAL NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'Beverages',
  category TEXT DEFAULT 'Drinks',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for Items
CREATE INDEX IF NOT EXISTS idx_items_org ON items(organization_id);
CREATE INDEX IF NOT EXISTS idx_items_short_code ON items(short_code);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
