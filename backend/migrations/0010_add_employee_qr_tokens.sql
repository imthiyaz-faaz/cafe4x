-- Migration: 0011_add_employee_qr_tokens.sql
-- Description:
-- 1. Add qr_token, qr_token_created_at, and qr_token_status to users table
-- 2. Add employee_id and qr_token to orders table to associate each order with authenticated employee
-- 3. Create unique index on qr_token for fast lookup and strict uniqueness

ALTER TABLE users ADD COLUMN qr_token TEXT;
ALTER TABLE users ADD COLUMN qr_token_created_at TEXT;
ALTER TABLE users ADD COLUMN qr_token_status TEXT DEFAULT 'active';

ALTER TABLE orders ADD COLUMN employee_id TEXT;
ALTER TABLE orders ADD COLUMN qr_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_qr_token ON users(qr_token);
CREATE INDEX IF NOT EXISTS idx_orders_employee ON orders(employee_id);
CREATE INDEX IF NOT EXISTS idx_orders_qr_token ON orders(qr_token);
