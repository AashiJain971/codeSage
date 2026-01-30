-- ===============================================================================
-- MIGRATION: Add SWOT Analysis Caching
-- Purpose: Cache generated SWOT analysis to avoid regenerating on every request
-- ===============================================================================

-- Create user_profiles table to store cached SWOT analysis
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Cached SWOT analysis
    swot_analysis JSONB DEFAULT NULL,
    
    -- Cache invalidation tracking
    last_interview_count INTEGER DEFAULT 0,
    last_interview_date TIMESTAMPTZ DEFAULT NULL,
    swot_generated_at TIMESTAMPTZ DEFAULT NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one profile per user
    CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Create index for faster lookups (drop first if exists)
DROP INDEX IF EXISTS idx_user_profiles_user_id;
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at (drop first if exists)
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();

-- Grant permissions - Allow backend service to manage profiles
-- Note: RLS is disabled to allow backend caching without auth context
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want RLS enabled, use these policies instead:
-- ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
-- 
-- -- Allow service role (backend) to do everything
-- CREATE POLICY "Service role full access"
--     ON user_profiles FOR ALL
--     USING (true)
--     WITH CHECK (true);
-- 
-- -- Allow authenticated users to view their own profile
-- CREATE POLICY "Users can view own profile"
--     ON user_profiles FOR SELECT
--     USING (auth.uid() = user_id OR auth.role() = 'service_role');
