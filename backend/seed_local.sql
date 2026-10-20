-- =====================================================================
-- CAFE4X LOCAL DEVELOPMENT SEED SCRIPT
-- Safely seeds local D1 database with test organization, users,
-- locations, seats, items, working hours, and employee break sessions.
-- Safe development credentials: password123
-- =====================================================================

-- 1. Organizations
INSERT OR REPLACE INTO organizations (id, display_id, name, short_code, owner_user_id, created_at)
VALUES 
  ('org_fts_local', 'ORG-FTS-0001', 'Faaz Tech Solutions', 'FTS', 'USR-0001', datetime('now')),
  ('org_cafe_local', 'ORG-CAFE-0001', 'Cafe4X HQ', 'CAFE', 'USR-0001', datetime('now'));

-- 2. Users (Admin, Provider, Employee with safe dev credentials: password123)
-- Hash: pbkdf2_sha256$a1b2c3d4e5f60718$74f8c6c83a4fab105594a112081baa0a71dd9edc9c1d167665b4940954013a36
INSERT OR REPLACE INTO users (id, display_id, name, user_name, email, password, password_hash, mobile_number, user_type, qr_token, created_at)
VALUES
  ('USR-0001', 'USR-0001', 'Local Admin', 'admin', 'admin@local.test', 'password123', 'pbkdf2_sha256$a1b2c3d4e5f60718$74f8c6c83a4fab105594a112081baa0a71dd9edc9c1d167665b4940954013a36', '+971500000001', 'Admin', 'QR_ADMIN_LOCAL', datetime('now')),
  ('USR-0004', 'USR-0004', 'Faaz Admin', 'faazadmin', 'admin@faaz.com', 'password123', 'pbkdf2_sha256$a1b2c3d4e5f60718$74f8c6c83a4fab105594a112081baa0a71dd9edc9c1d167665b4940954013a36', '+971500000004', 'Admin', 'QR_FAAZ_ADMIN', datetime('now')),
  ('USR-0002', 'USR-0002', 'Cafe Provider', 'provider', 'provider@local.test', 'password123', 'pbkdf2_sha256$a1b2c3d4e5f60718$74f8c6c83a4fab105594a112081baa0a71dd9edc9c1d167665b4940954013a36', '+971500000002', 'Provider', 'QR_PROV_LOCAL', datetime('now')),
  ('USR-0003', 'USR-0003', 'John Employee', 'employee', 'employee@local.test', 'password123', 'pbkdf2_sha256$a1b2c3d4e5f60718$74f8c6c83a4fab105594a112081baa0a71dd9edc9c1d167665b4940954013a36', '+971500000003', 'Employee', 'EMP_LOCAL_0001', datetime('now'));

-- 3. User Organizations Junction
INSERT OR REPLACE INTO user_organizations (id, user_id, organization_id, role, created_at)
VALUES
  ('uo_admin_fts', 'USR-0001', 'org_fts_local', 'Owner', datetime('now')),
  ('uo_admin_cafe', 'USR-0001', 'org_cafe_local', 'Owner', datetime('now')),
  ('uo_faaz_fts', 'USR-0004', 'org_fts_local', 'Owner', datetime('now')),
  ('uo_prov_fts', 'USR-0002', 'org_fts_local', 'Provider', datetime('now')),
  ('uo_emp_fts', 'USR-0003', 'org_fts_local', 'Employee', datetime('now'));

-- 4. Locations
INSERT OR REPLACE INTO locations (id, display_id, organization_id, short_code, name, status, total_seats, created_at)
VALUES
  ('loc_fts_001', 'LOC-FTS-0001', 'org_fts_local', 'FTS', 'Main Cafeteria', 'Active', 10, datetime('now')),
  ('loc_fts_002', 'LOC-FTS-0002', 'org_fts_local', 'FTS', 'Executive Lounge - 3rd Floor', 'Active', 8, datetime('now'));

-- 5. Seats
INSERT OR REPLACE INTO seats (id, display_id, location_id, organization_id, number, employee_name, employee_email, employee_id, order_url, created_at)
VALUES
  ('seat_fts_001', 'SEAT-FTS-0001', 'loc_fts_001', 'org_fts_local', 'Table 1 - Seat A', 'John Employee', 'employee@local.test', 'USR-0003', 'http://localhost:5173/order/entry?loc=loc_fts_001&seat=seat_fts_001', datetime('now')),
  ('seat_fts_002', 'SEAT-FTS-0002', 'loc_fts_001', 'org_fts_local', 'Table 1 - Seat B', NULL, NULL, NULL, 'http://localhost:5173/order/entry?loc=loc_fts_001&seat=seat_fts_002', datetime('now')),
  ('seat_fts_003', 'SEAT-FTS-0003', 'loc_fts_001', 'org_fts_local', 'Table 2 - Seat A', NULL, NULL, NULL, 'http://localhost:5173/order/entry?loc=loc_fts_001&seat=seat_fts_003', datetime('now'));

-- 6. Provider Locations Assignment
INSERT OR REPLACE INTO provider_locations (id, organization_id, provider_id, location_id, created_at)
VALUES
  ('pl_prov_loc1', 'org_fts_local', 'USR-0002', 'loc_fts_001', datetime('now'));

-- 7. Items
INSERT OR REPLACE INTO items (id, display_id, organization_id, short_code, name, description, amount, type, category, status, created_at)
VALUES
  ('item_fts_001', 'ITEM-FTS-0001', 'org_fts_local', 'FTS', 'Espresso', 'Rich single shot espresso', 12.0, 'Beverages', 'Hot Drinks', 'Active', datetime('now')),
  ('item_fts_002', 'ITEM-FTS-0002', 'org_fts_local', 'FTS', 'Cappuccino', 'Steamed milk and velvety foam', 15.0, 'Beverages', 'Hot Drinks', 'Active', datetime('now')),
  ('item_fts_003', 'ITEM-FTS-0003', 'org_fts_local', 'FTS', 'Spanish Latte', 'Sweet condensed milk with espresso over ice', 18.0, 'Beverages', 'Cold Drinks', 'Active', datetime('now')),
  ('item_fts_004', 'ITEM-FTS-0004', 'org_fts_local', 'FTS', 'Butter Croissant', 'Freshly baked flaky French croissant', 10.0, 'Food', 'Bakery', 'Active', datetime('now')),
  ('item_fts_005', 'ITEM-FTS-0005', 'org_fts_local', 'FTS', 'Club Sandwich', 'Triple decker chicken, cheese and egg sandwich', 22.0, 'Food', 'Snacks', 'Active', datetime('now'));

-- 8. Working Hours & Break Sessions
INSERT OR REPLACE INTO working_hours (id, organization_id, open_time, close_time, timezone, is_emergency_closed, break_sessions_json, created_at, updated_at)
VALUES
  (
    'wh_fts_local',
    'org_fts_local',
    '08:00',
    '22:00',
    'Asia/Dubai',
    0,
    '[{"id":"break-1","name":"Morning Tea","startTime":"10:00","endTime":"10:30","duration":30,"enabled":true},{"id":"break-2","name":"Lunch Break","startTime":"13:00","endTime":"14:00","duration":60,"enabled":true},{"id":"break-3","name":"Evening Coffee","startTime":"16:00","endTime":"16:30","duration":30,"enabled":true},{"id":"break-4","name":"Late Break","startTime":"18:00","endTime":"18:30","duration":30,"enabled":false},{"id":"break-5","name":"Night Session","startTime":"20:00","endTime":"20:30","duration":30,"enabled":false}]',
    datetime('now'),
    datetime('now')
  ),
  (
    'wh_cafe_local',
    'org_cafe_local',
    '07:00',
    '21:00',
    'Asia/Dubai',
    0,
    '[{"id":"break-1","name":"Morning Coffee","startTime":"09:30","endTime":"10:00","duration":30,"enabled":true},{"id":"break-2","name":"Afternoon Break","startTime":"15:00","endTime":"15:30","duration":30,"enabled":true}]',
    datetime('now'),
    datetime('now')
  );

-- 9. ID Sequences Initialization
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('USERS', 4);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORG_FTS', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORG_CAFE', 1);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('LOC_FTS', 2);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ITEM_FTS', 5);
INSERT OR REPLACE INTO id_sequences (scope, last_val) VALUES ('ORD_FTS_2026', 0);
