#!/usr/bin/env python3
"""
Run SWOT cache migration
This script creates the user_profiles table in Supabase for caching SWOT analysis
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Missing Supabase credentials in .env file")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Read the migration SQL
with open("migrations/add_swot_analysis_cache.sql", "r") as f:
    migration_sql = f.read()

print("🚀 Running SWOT cache migration...")
print("=" * 60)

try:
    # Execute the migration
    result = supabase.rpc("execute_sql", {"sql": migration_sql}).execute()
    print("✅ Migration completed successfully!")
    print("\n📊 User profiles table created with:")
    print("   - swot_analysis (JSONB) - Cached SWOT data")
    print("   - last_interview_count - Track interview count changes")
    print("   - last_interview_date - Track new interviews")
    print("   - swot_generated_at - Cache timestamp")
    print("\n💾 SWOT analysis will now be cached and reused!")
    
except Exception as e:
    print(f"❌ Migration failed: {e}")
    print("\n⚠️  Manual steps:")
    print("1. Go to Supabase Dashboard > SQL Editor")
    print("2. Copy and paste the contents of migrations/add_swot_analysis_cache.sql")
    print("3. Click 'Run'")
    exit(1)
