-- Migration: 0006_add_display_ids_and_auth_security.sql
ALTER TABLE organizations ADD COLUMN display_id TEXT;
ALTER TABLE users ADD COLUMN display_id TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE locations ADD COLUMN display_id TEXT;
ALTER TABLE items ADD COLUMN display_id TEXT;
ALTER TABLE orders ADD COLUMN display_id TEXT;
ALTER TABLE seats ADD COLUMN display_id TEXT;

CREATE INDEX IF NOT EXISTS idx_org_display ON organizations(display_id);
CREATE INDEX IF NOT EXISTS idx_user_display ON users(display_id);
CREATE INDEX IF NOT EXISTS idx_loc_display ON locations(display_id);
CREATE INDEX IF NOT EXISTS idx_items_display ON items(display_id);
CREATE INDEX IF NOT EXISTS idx_orders_display ON orders(display_id);
CREATE INDEX IF NOT EXISTS idx_seats_display ON seats(display_id);
