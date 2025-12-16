#!/usr/bin/env python3
"""
Simple test to verify Supabase tables are created and accessible
Run this after creating tables in Supabase dashboard
"""
import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append('/Users/adityajain/CodeSage/backend')

from database import db, supabase

async def verify_tables():
    """Verify that Supabase tables exist and are accessible"""
    if not supabase:
        print("❌ Supabase client not initialized")
        return False
    
    try:
        print("🔍 Testing Supabase table access...")
        
        # Test 1: Check if interviews table exists and is accessible
        print("\n📋 Testing interviews table...")
        try:
            result = supabase.table("interviews").select("*").limit(1).execute()
            print(f"✅ Interviews table accessible: {len(result.data)} records found")
        except Exception as e:
            print(f"❌ Interviews table error: {e}")
            return False
        
        # Test 2: Check if question_responses table exists and is accessible
        print("\n📝 Testing question_responses table...")
        try:
            result = supabase.table("question_responses").select("*").limit(1).execute()
            print(f"✅ Question responses table accessible: {len(result.data)} records found")
        except Exception as e:
            print(f"❌ Question responses table error: {e}")
            return False
        
        # Test 3: Try to create a test interview record
        print("\n🧪 Testing database operations...")
        try:
            test_data = {
                "session_id": "test-python-" + str(int(asyncio.get_event_loop().time())),
                "interview_type": "technical",
                "topics": ["Python", "Testing"],
                "start_time": "2024-01-01T12:00:00Z",
                "total_questions": 2,
                "status": "completed"
            }
            
            interview_id = await db.create_interview_session(test_data)
            if interview_id:
                print(f"✅ Test interview created successfully: {interview_id}")
                
                # Try to retrieve it
                results = await db.get_interview_results(test_data["session_id"])
                if results:
                    print(f"✅ Test interview retrieved successfully")
                    print(f"   Session: {results['session_id']}")
                    print(f"   Type: {results['interview_type']}")
                    print(f"   Topics: {results['topics']}")
                    print(f"   Status: {results['status']}")
                else:
                    print("⚠️ Could not retrieve test interview")
            else:
                print("❌ Failed to create test interview")
                return False
        except Exception as e:
            print(f"❌ Database operations test failed: {e}")
            return False
        
        print("\n🎉 All tests passed! Database is ready for use.")
        return True
        
    except Exception as e:
        print(f"❌ General database test failed: {e}")
        return False

async def main():
    print("🚀 Verifying Supabase database setup...")
    print(f"📍 Database URL: {os.getenv('SUPABASE_URL')}")
    
    success = await verify_tables()
    
    if success:
        print("\n✅ SUCCESS: Your Supabase database is properly configured!")
        print("🎯 You can now use the interview system with database storage.")
    else:
        print("\n❌ FAILED: Please ensure you've created the tables in Supabase.")
        print("📋 Go to your Supabase dashboard SQL Editor and run the commands from:")
        print("   📁 supabase_create_tables.sql")

if __name__ == "__main__":
    asyncio.run(main())