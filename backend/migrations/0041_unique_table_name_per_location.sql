-- Migration: 0041_unique_table_name_per_location.sql
-- Description:
-- Create unique indexes on (location_id, LOWER(TRIM(name))) for tables
-- and (location_id, LOWER(TRIM(table_name))) for location_tables
-- ensuring case-insensitive and whitespace-trimmed table name uniqueness per location.

CREATE UNIQUE INDEX IF NOT EXISTS uq_tables_loc_lower_name 
ON tables(location_id, LOWER(TRIM(name)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_location_tables_loc_lower_name 
ON location_tables(location_id, LOWER(TRIM(table_name)));

