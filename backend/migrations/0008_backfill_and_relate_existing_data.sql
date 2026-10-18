-- Migration: 0007_backfill_and_relate_existing_data.sql

-- Backfill organizations display_id
UPDATE organizations SET display_id = 'ORG-' || UPPER(short_code) || '-0001' WHERE display_id IS NULL;

-- Backfill users display_id
UPDATE users SET display_id = 'USR-0001' WHERE id = '1792045402898' AND display_id IS NULL;
UPDATE users SET display_id = 'USR-0002' WHERE id = '1792048603680' AND display_id IS NULL;
UPDATE users SET display_id = 'USR-0003' WHERE id = '1792303764513' AND display_id IS NULL;

-- Backfill locations display_id
UPDATE locations SET display_id = 'LOC-' || UPPER(COALESCE(short_code, 'FTS')) || '-0001' WHERE id = '1792049878967' AND display_id IS NULL;
UPDATE locations SET display_id = 'LOC-' || UPPER(COALESCE(short_code, 'FTS')) || '-0002' WHERE id = '1792072861182' AND display_id IS NULL;
UPDATE locations SET display_id = 'LOC-' || UPPER(COALESCE(short_code, 'TEST')) || '-0001' WHERE id = '1792304963687' AND display_id IS NULL;

-- Backfill items display_id
UPDATE items SET display_id = 'ITEM-' || UPPER(COALESCE(short_code, 'FTS')) || '-0001' WHERE id = '1792058507689' AND display_id IS NULL;

-- Backfill orders display_id
UPDATE orders SET display_id = 'ORD-' || UPPER(COALESCE(short_code, 'TEST')) || '-2026-000001' WHERE id = '#ORD-4146' AND display_id IS NULL;

-- Populate provider_locations mapping for existing assignment
-- Location 1792049878967 (Meeting Hall A) was assigned to Provider 1792048603680 (cafeprovider) in Org org_fts_1792045402898
INSERT OR IGNORE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
VALUES (
  'pl_1792048603680_1792049878967',
  'org_fts_1792045402898',
  '1792048603680',
  '1792049878967',
  '2026-10-15 07:37:58'
);

-- Backfill order_items from #ORD-4146
INSERT OR IGNORE INTO order_items (id, order_id, organization_id, item_id, name, qty, unit_price, preference, created_at)
VALUES (
  'oi_ord_4146_1',
  '#ORD-4146',
  'org_test_1792303370097',
  NULL,
  'Espresso',
  1,
  15.0,
  NULL,
  '2026-10-18 06:29:24'
);

-- Initialize sequence values in id_sequences table
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('USERS', 3);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORG_FTS', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORG_TEST', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORG_PTF', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('LOC_FTS', 2);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('LOC_TEST', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ITEM_FTS', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORD_TEST_2026', 1);
