-- Migration 0021: Drop organization name unique index so multiple organizations can share the same name
-- Organization short codes remain strictly unique

DROP INDEX IF EXISTS idx_organizations_name_nocase;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_short_code_nocase ON organizations(LOWER(TRIM(short_code)));

