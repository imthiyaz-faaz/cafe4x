-- Migration: 0012_add_seat_employee_fields.sql
-- Description:
-- Separate seat information from employee assignment information.
-- Add explicit employee_name, employee_email, and employee_id columns to seats table.
-- Existing 'employee' column is preserved for backward compatibility.

ALTER TABLE seats ADD COLUMN employee_name TEXT;
ALTER TABLE seats ADD COLUMN employee_email TEXT;
ALTER TABLE seats ADD COLUMN employee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_seats_employee_id ON seats(employee_id);
CREATE INDEX IF NOT EXISTS idx_seats_employee_email ON seats(employee_email);
