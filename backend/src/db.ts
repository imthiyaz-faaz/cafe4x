const dbPath = "C:/Users/imthi/OneDrive/Desktop/Cafe4x/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite";
let dbInstance: any = null;

export function getDb(): any {
  if (!dbInstance) {
    let DatabaseSync: any = null;
    try {
      // 1. Try global process built-in
      DatabaseSync = (globalThis as any).process?.getBuiltinModule?.("node:sqlite")?.DatabaseSync;
      // 2. Try Node module createRequire
      if (!DatabaseSync) {
        try {
          const { createRequire } = (globalThis as any).process?.getBuiltinModule?.("node:module") || {};
          if (createRequire) {
            DatabaseSync = createRequire(process.cwd())("node:sqlite")?.DatabaseSync;
          }
        } catch {}
      }
      // 3. Try standard require
      if (!DatabaseSync) {
        const req = (globalThis as any).require;
        if (req) {
          DatabaseSync = req("node:sqlite")?.DatabaseSync;
        }
      }
    } catch (e) {
      console.warn("Could not load node:sqlite DatabaseSync:", e);
    }

    if (DatabaseSync) {
      dbInstance = new DatabaseSync(dbPath);
    } else {
      console.warn("node:sqlite not available in this environment. Falling back to in-memory store.");
      dbInstance = {
        prepare: () => ({
          all: () => [],
          get: () => null,
          run: () => ({ changes: 0, lastInsertRowid: 0 }),
        }),
        exec: () => {},
      };
    }
    // Ensure tables exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        short_code TEXT NOT NULL UNIQUE,
        owner_user_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        user_name TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        mobile_number TEXT,
        user_type TEXT NOT NULL DEFAULT 'Admin',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_organizations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'Owner',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        UNIQUE(user_id, organization_id)
      );

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

      CREATE INDEX IF NOT EXISTS idx_user_org_user ON user_organizations(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_org_org ON user_organizations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_org_short_code ON organizations(short_code);
      CREATE INDEX IF NOT EXISTS idx_loc_org ON locations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_loc_short_code ON locations(short_code);
      CREATE INDEX IF NOT EXISTS idx_loc_provider ON locations(assigned_provider_id);
      CREATE INDEX IF NOT EXISTS idx_items_org ON items(organization_id);
      CREATE INDEX IF NOT EXISTS idx_items_short_code ON items(short_code);
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    `);
  }
  return dbInstance;
}
