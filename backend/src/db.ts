// @ts-ignore
import { DatabaseSync } from "node:sqlite";

const dbPath = "C:/Users/imthi/OneDrive/Desktop/Cafe4x/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/metadata.sqlite";

let dbInstance: any = null;

export function getDb(): any {
  if (!dbInstance) {
    dbInstance = new (DatabaseSync as any)(dbPath);
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

      CREATE INDEX IF NOT EXISTS idx_user_org_user ON user_organizations(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_org_org ON user_organizations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_org_short_code ON organizations(short_code);
      CREATE INDEX IF NOT EXISTS idx_loc_org ON locations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_loc_short_code ON locations(short_code);
      CREATE INDEX IF NOT EXISTS idx_loc_provider ON locations(assigned_provider_id);
    `);
  }
  return dbInstance;
}
