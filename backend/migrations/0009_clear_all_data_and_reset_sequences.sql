-- =====================================================================
-- CAFE4X APPLICATION DATA RESET & SEQUENCE INITIALIZATION
-- Preserves tables, columns, indexes, and constraints.
-- Clears all business records and resets sequence generators to 0.
-- =====================================================================

PRAGMA foreign_keys = OFF;

-- 1. Delete all records from child/dependent tables first
DELETE FROM order_items;
DELETE FROM provider_locations;
DELETE FROM seats;
DELETE FROM orders;
DELETE FROM items;
DELETE FROM working_hours;
DELETE FROM locations;
DELETE FROM user_organizations;
DELETE FROM users;
DELETE FROM organizations;

-- 2. Reset ID sequences table so all counters start clean from 0
DELETE FROM id_sequences;

-- 3. Reset sqlite autoincrement sequence if any exist
DELETE FROM sqlite_sequence WHERE name NOT IN ('d1_migrations');

PRAGMA foreign_keys = ON;
