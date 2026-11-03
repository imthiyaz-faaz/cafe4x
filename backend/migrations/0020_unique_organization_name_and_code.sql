-- Migration 0020: Ensure Case-Insensitive Unique Constraints on Organization Name and Short Code
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_nocase ON organizations(name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_short_code_nocase ON organizations(short_code COLLATE NOCASE);

