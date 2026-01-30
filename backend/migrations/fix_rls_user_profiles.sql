-- ===============================================================================
-- QUICK FIX: Disable RLS on user_profiles table
-- Run this if you already ran the previous migration
-- ===============================================================================

-- Disable RLS to allow backend caching
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Success message
SELECT 'RLS disabled for user_profiles - backend can now cache SWOT analysis' as status;
