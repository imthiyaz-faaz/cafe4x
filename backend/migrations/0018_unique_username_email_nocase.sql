-- Ensure Case-Insensitive Unique Constraints on users table for username and email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_nocase ON users(user_name COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_nocase ON users(email COLLATE NOCASE);

