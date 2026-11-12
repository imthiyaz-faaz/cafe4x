-- Migration: 0040_remove_employee_from_users.sql
-- Description:
-- 1. Ensure id_sequences has 'EMPLOYEES' scope initialized.
-- 2. Remove FOREIGN KEY (employee_id) REFERENCES users(id) from:
--      - seats
--      - location_table_seats
--      - employee_seat_assignments
--      - ordering_sessions
--    so employee management is completely decoupled from the users table.
-- 3. Update employee_id in seats, location_table_seats, and employee_seat_assignments:
--    Convert USR- prefix to EMP- for records where user_type was 'Employee'.
-- 4. Delete employee accounts from user_organizations, user_sessions, and users table.
--    The users table must contain only Admin and Provider accounts.

PRAGMA foreign_keys = OFF;

-- 1. Initialize EMPLOYEES sequence if not present
INSERT INTO id_sequences (scope, last_val) VALUES ('EMPLOYEES', 0)
ON CONFLICT(scope) DO NOTHING;

-- 2. Update employee_id in seats from USR- to EMP- where user_type was Employee
UPDATE seats 
SET employee_id = 'EMP-' || SUBSTR(employee_id, 5)
WHERE employee_id IN (SELECT id FROM users WHERE LOWER(user_type) = 'employee') AND employee_id LIKE 'USR-%';

-- Update employee_id in location_table_seats
UPDATE location_table_seats 
SET employee_id = 'EMP-' || SUBSTR(employee_id, 5)
WHERE employee_id IN (SELECT id FROM users WHERE LOWER(user_type) = 'employee') AND employee_id LIKE 'USR-%';

-- Update employee_id in employee_seat_assignments
UPDATE employee_seat_assignments 
SET employee_id = 'EMP-' || SUBSTR(employee_id, 5)
WHERE employee_id IN (SELECT id FROM users WHERE LOWER(user_type) = 'employee') AND employee_id LIKE 'USR-%';

-- 3. Delete employee accounts from user_organizations
DELETE FROM user_organizations WHERE user_id IN (SELECT id FROM users WHERE LOWER(user_type) = 'employee');

-- Delete employee sessions
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE LOWER(user_type) = 'employee');

-- Delete employee records from users table
DELETE FROM users WHERE LOWER(user_type) = 'employee';

-- 4. Recreate seats table without FOREIGN KEY (employee_id) REFERENCES users(id)
CREATE TABLE IF NOT EXISTS "seats_new" (
  id TEXT PRIMARY KEY,
  table_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  organization_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  employee_id TEXT,
  employee TEXT,
  employee_name TEXT,
  employee_email TEXT,
  qr_token TEXT UNIQUE,
  order_url TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(table_id, number)
);

INSERT INTO "seats_new" SELECT * FROM "seats";
DROP TABLE "seats";
ALTER TABLE "seats_new" RENAME TO "seats";

-- 5. Recreate location_table_seats table without FOREIGN KEY (employee_id) REFERENCES users(id)
CREATE TABLE IF NOT EXISTS "location_table_seats_new" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  seat_number INTEGER NOT NULL,
  seat_identifier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  employee_id TEXT,
  employee_name TEXT,
  employee_email TEXT,
  qr_token TEXT UNIQUE,
  order_url TEXT,
  created_at DATETIME NOT NULL DEFAULT (datetime('now')),
  updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (table_id) REFERENCES location_tables(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE(table_id, seat_number)
);

INSERT INTO "location_table_seats_new" SELECT * FROM "location_table_seats";
DROP TABLE "location_table_seats";
ALTER TABLE "location_table_seats_new" RENAME TO "location_table_seats";

CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_tbl_id ON location_table_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_loc_id ON location_table_seats(location_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_org_id ON location_table_seats(organization_id);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_status ON location_table_seats(status);
CREATE INDEX IF NOT EXISTS idx_loc_tbl_seats_emp_id ON location_table_seats(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loc_tbl_seats_qr ON location_table_seats(qr_token);

-- 6. Recreate employee_seat_assignments table without FOREIGN KEY (employee_id) REFERENCES users(id)
CREATE TABLE IF NOT EXISTS "employee_seat_assignments_new" (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
  FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE,
  UNIQUE(location_id, seat_id),
  UNIQUE(organization_id, employee_id)
);

INSERT INTO "employee_seat_assignments_new" SELECT * FROM "employee_seat_assignments";
DROP TABLE "employee_seat_assignments";
ALTER TABLE "employee_seat_assignments_new" RENAME TO "employee_seat_assignments";

CREATE INDEX IF NOT EXISTS idx_seat_assignments_org ON employee_seat_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_loc ON employee_seat_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_seat ON employee_seat_assignments(seat_id);
CREATE INDEX IF NOT EXISTS idx_seat_assignments_emp ON employee_seat_assignments(employee_id);

-- 7. Recreate ordering_sessions table without FOREIGN KEY (employee_id) REFERENCES users(id)
CREATE TABLE IF NOT EXISTS "ordering_sessions_new" (
  id TEXT PRIMARY KEY,
  temp_token_hash TEXT NOT NULL UNIQUE,
  employee_id TEXT,
  organization_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  seat_id TEXT,
  seat_number TEXT,
  location_id TEXT,
  location_name TEXT,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

INSERT INTO "ordering_sessions_new" SELECT * FROM "ordering_sessions";
DROP TABLE "ordering_sessions";
ALTER TABLE "ordering_sessions_new" RENAME TO "ordering_sessions";

PRAGMA foreign_keys = ON;
