-- ===============================================================================
-- MIGRATION: Add email to user_profiles table
-- Purpose: Store user email in user_profiles so public profiles can display it
-- ===============================================================================

-- Add email column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

SELECT 'Email column added to user_profiles table' as status;
