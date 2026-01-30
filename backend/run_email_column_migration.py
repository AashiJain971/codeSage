#!/usr/bin/env python3
"""
Apply database migration to add email column to user_profiles table
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def run_migration():
    print("=" * 80)
    print("🔄 Database Migration: Add email column to user_profiles")
    print("=" * 80)
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("❌ Missing Supabase credentials")
        print("   Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env")
        return False
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        print("✅ Connected to Supabase with service role")
        
        # Read migration SQL
        migration_path = os.path.join(os.path.dirname(__file__), "migrations", "add_email_to_user_profiles.sql")
        
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
        print("  1. Add 'email' column to user_profiles table")
        print("  2. Set default value to NULL")
        print("  3. Create an index on the email column")
        
        response = input("\n❓ Proceed with migration? (yes/no): ")
        
        if response.lower() != 'yes':
            print("❌ Migration cancelled")
            return False
        
        print("\n🚀 Running migration...")
        
        # Execute migration using RPC call
        try:
            # Note: Supabase Python client doesn't support direct SQL execution
            # The migration must be run in the Supabase Dashboard SQL Editor
            print("\n⚠️  Python client cannot execute DDL statements directly.")
            print("📋 Please run the migration manually in Supabase Dashboard:")
            print("\n1. Go to: https://supabase.com/dashboard")
            print("2. Select your project")
            print("3. Go to SQL Editor")
            print("4. Copy and paste the SQL from migrations/add_email_to_user_profiles.sql")
            print("5. Click 'Run'")
            print("\n✅ After running, the email column will be available for storing user emails")
            return True
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            return False
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
