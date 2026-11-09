-- Migration 0029: Resolve existing username duplicates and ensure global case-insensitive uniqueness on users(user_name)
-- Ensures duplicate usernames cannot be created across organizations.

-- Step 1: Update duplicate legacy usernames (if any exist) by appending a suffix so UNIQUE index can be created safely
UPDATE users 
SET user_name = user_name || '_' || substr(id, -4)
WHERE id IN (
  SELECT u1.id
  FROM users u1
  JOIN users u2 ON LOWER(TRIM(u1.user_name)) = LOWER(TRIM(u2.user_name)) AND u1.id > u2.id
);

-- Step 2: Create global unique index on case-insensitive trimmed user_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase ON users(LOWER(TRIM(user_name)));

