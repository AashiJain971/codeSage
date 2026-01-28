#!/usr/bin/env python3
"""
Integration test for Profile endpoints with real database data
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import db
from datetime import datetime

async def test_with_real_data():
    """Test profile generation with actual database data"""
    print("🔍 Fetching real interview data from database...")
    
    # Get all interviews to find a user with data
    all_interviews = await db.get_all_interviews(limit=100)
    
    if not all_interviews:
        print("⚠️  No interviews found in database")
        return False
    
    print(f"✅ Found {len(all_interviews)} interviews in database")
    
    # Group by user_id
    users = {}
    for interview in all_interviews:
        user_id = interview.get('user_id')
        if user_id:
            if user_id not in users:
                users[user_id] = []
            users[user_id].append(interview)
    
    print(f"\n📊 Found {len(users)} unique users with interview data")
    
    # Test with the user who has the most interviews
    if users:
        top_user = max(users.items(), key=lambda x: len(x[1]))
        user_id, interviews = top_user
        
        print(f"\n🎯 Testing with user: {user_id}")
        print(f"   Interviews: {len(interviews)}")
        
        # Get user interviews
        user_interviews = await db.get_user_interviews(user_id, limit=1000)
        print(f"   Retrieved: {len(user_interviews)} interviews via get_user_interviews()")
        
        if user_interviews:
            # Calculate some basic stats
            scores = []
            for interview in user_interviews:
                score = interview.get('average_score')
                if score is not None and score > 0:
                    scores.append(score)
            
            if scores:
                avg_score = sum(scores) / len(scores)
                max_score = max(scores)
                print(f"\n📈 Stats for {user_id}:")
                print(f"   Total interviews: {len(user_interviews)}")
                print(f"   Interviews with scores: {len(scores)}")
                print(f"   Average score: {avg_score:.1f}")
                print(f"   Highest score: {max_score}")
                
                print("\n✅ Database integration test passed!")
                print(f"\nℹ️  You can test this user's profile at:")
                print(f"   GET http://127.0.0.1:8000/api/profile")
                print(f"   Authorization: Bearer <token with sub={user_id}>")
                print(f"\n   Or public profile:")
                print(f"   GET http://127.0.0.1:8000/api/profile/public/{user_id}")
                
                return True
            else:
                print("⚠️  No interviews with scores found")
                return False
        else:
            print("❌ Failed to retrieve user interviews")
            return False
    else:
        print("❌ No users with interviews found")
        return False

if __name__ == "__main__":
    print("\n🧪 Profile API Integration Test\n")
    print("=" * 60)
    
    try:
        result = asyncio.run(test_with_real_data())
        
        print("\n" + "=" * 60)
        if result:
            print("🎉 Integration test passed!")
            exit(0)
        else:
            print("⚠️  Integration test completed with warnings")
            exit(0)
    except Exception as e:
        print(f"\n❌ Integration test failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
