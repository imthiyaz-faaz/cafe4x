-- ============================================================================
-- Migration: 0034_location_employee_email_uniqueness.sql
-- Description: Enforce location-level employee email uniqueness within an organization:
--              An employee email must be unique within (organization_id, location_id, normalized_email),
--              while allowing the same employee email in different locations or organizations.
-- ============================================================================

-- Partial unique index ensuring that within the same organization and location,
-- non-null, non-empty employee emails cannot be duplicated (case-insensitive & trimmed).
CREATE UNIQUE INDEX IF NOT EXISTS idx_seats_org_loc_employee_email_nocase
ON seats (
  organization_id,
  location_id,
  LOWER(TRIM(employee_email))
)
WHERE employee_email IS NOT NULL AND TRIM(employee_email) != '';

