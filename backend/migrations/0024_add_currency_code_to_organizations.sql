-- Migration 0024: Ensure organizations table has currency_code column
-- Adds currency_code TEXT NOT NULL DEFAULT 'INR' to organizations if missing

-- Check and add column safely
ALTER TABLE organizations ADD COLUMN currency_code TEXT NOT NULL DEFAULT 'INR';
