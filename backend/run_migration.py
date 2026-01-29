#!/usr/bin/env python3
"""
Apply database migration to add language column to question_responses table
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

def run_migration():
    print("=" * 80)
    print("🔄 Database Migration: Add language column to question_responses")
    print("=" * 80)
    
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("❌ Missing Supabase credentials")
        return False
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Connected to Supabase")
        
        # Read migration SQL
        migration_path = os.path.join(os.path.dirname(__file__), "migrations", "add_language_to_question_responses.sql")
        
        if not os.path.exists(migration_path):
            print(f"❌ Migration file not found: {migration_path}")
            return False
        
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print("\n📋 Migration SQL:")
        print("-" * 80)
        print(migration_sql)
        print("-" * 80)
        
        print("\n⚠️  This migration will:")
        print("  1. Add 'language' column to question_responses table")
        print("  2. Set default value to 'python'")
        print("  3. Update existing NULL values to 'python'")
        print("  4. Create an index on the language column")
        
        response = input("\n❓ Proceed with migration? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Migration cancelled")
            return False
        
        print("\n🚀 Executing migration...")
        
        # Note: Supabase client doesn't directly support raw SQL execution
        # You need to run this SQL in the Supabase SQL Editor or use a PostgreSQL client
        print("\n📝 MANUAL STEPS REQUIRED:")
        print("=" * 80)
        print("1. Go to your Supabase Dashboard: https://supabase.com/dashboard")
        print("2. Navigate to SQL Editor")
        print("3. Copy and paste the following SQL:")
        print("=" * 80)
        print(migration_sql)
        print("=" * 80)
        print("4. Click 'Run' to execute the migration")
        print("\nAlternatively, use psql or any PostgreSQL client with your database credentials.")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
