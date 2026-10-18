-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  short_code TEXT,
  seat TEXT NOT NULL,
  location_id TEXT,
  location_name TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  total REAL NOT NULL DEFAULT 0,
  time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  items_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Seats Table for location seating plans and employee assignments
CREATE TABLE IF NOT EXISTS seats (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  number TEXT NOT NULL,
  employee TEXT,
  order_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  UNIQUE(location_id, number)
);

CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_orders_short_code ON orders(short_code);
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_seats_location ON seats(location_id);
CREATE INDEX IF NOT EXISTS idx_seats_org ON seats(organization_id);
