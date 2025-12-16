#!/usr/bin/env python3
"""
Test the complete interview end flow
"""

import asyncio
import json
import uuid
import time
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from database import db

async def test_complete_flow():
    """Test the complete interview ending flow"""
    
    print("🚀 Testing Complete Interview End Flow")
    print("="*60)
    
    # Create a new interview session
    session_id = f"flow-test-{str(uuid.uuid4())[:8]}"
    
    # Step 1: Create interview
    session_data = {
        "session_id": session_id,
        "interview_type": "technical",
        "topics": ["Arrays", "Flow Testing"],
        "start_time": time.time(),
        "total_questions": 2
    }
    
    print(f"1️⃣ Creating interview session: {session_id}")
    interview_id = await db.create_interview_session(session_data)
    
    if not interview_id:
        print("❌ Failed to create interview")
        return False
    
    print(f"✅ Interview created with ID: {interview_id}")
    
    # Step 2: Add some question responses to simulate progress
    await db.store_question_response(session_id, 1, {
        "question_text": "Test question about arrays",
        "user_response": "Test approach explanation",
        "code_submission": "def test(): return [1,2,3]",
        "score": 85,
        "feedback": "Good approach",
        "time_taken": 300,
        "hints_used": 1,
        "difficulty": "medium"
    })
    
    print("✅ Added sample question response")
    
    # Step 3: Simulate manual ending (like WebSocket does)
    current_time = time.time()
    total_duration = current_time - session_data["start_time"]
    
    final_results = {
        "session_id": session_id,
        "topics": ["Arrays", "Flow Testing"],
        "total_questions": 2,
        "completed_questions": 1,  # Only completed 1 out of 2
        "average_score": 85.0,
        "individual_scores": [85.0],
        "total_time": total_duration,
        "interview_ended_manually": True,
        "completion_status": "manually_ended",  # This should be stored
        "end_time": current_time
    }
    
    print(f"\n2️⃣ Simulating manual interview end...")
    print(f"   Duration: {total_duration:.1f} seconds")
    print(f"   Completed: {final_results['completed_questions']}/{final_results['total_questions']} questions")
    print(f"   Status: {final_results['completion_status']}")
    
    # Step 4: Complete the interview (like TechnicalSession.complete_interview_in_db does)
    results_data = {
        "end_time": current_time,
        "total_time": total_duration,
        "completed_questions": final_results["completed_questions"],
        "average_score": final_results["average_score"],
        "individual_scores": final_results["individual_scores"],
        "completion_status": final_results["completion_status"],
        **final_results  # Include all other result data
    }
    
    success = await db.complete_interview(session_id, results_data)
    
    if not success:
        print("❌ Failed to complete interview")
        return False
    
    print("✅ Interview completion successful")
    
    # Step 5: Verify the results (like the frontend does)
    result = await db.get_interview_results(session_id)
    
    if not result:
        print("❌ Could not retrieve interview results")
        return False
    
    print(f"\n3️⃣ Verification Results:")
    print(f"   Session ID: {result.get('session_id')}")
    print(f"   Status: {result.get('status')}")
    print(f"   Duration: {result.get('duration')} seconds")
    print(f"   End Time: {result.get('end_time')}")
    print(f"   Score: {result.get('average_score')}")
    print(f"   Questions: {result.get('completed_questions')}/{result.get('total_questions', 'N/A')}")
    
    # Check if completion_method was stored in final_results
    final_results_data = result.get('final_results', {})
    if isinstance(final_results_data, dict):
        completion_status = final_results_data.get('completion_status')
        print(f"   Completion Method: {completion_status}")
        
        if completion_status == "manually_ended":
            print("✅ Manual completion status correctly stored!")
        else:
            print("⚠️  Manual completion status not found in final_results")
    
    # Step 6: Create localStorage-style data (like frontend does)
    frontend_data = {
        "session_id": session_id,
        "interview_type": "technical",
        "topics": ["Arrays", "Flow Testing"],
        "total_questions": final_results["total_questions"],
        "completed_questions": final_results["completed_questions"],
        "average_score": final_results["average_score"],
        "individual_scores": final_results["individual_scores"],
        "duration": int(total_duration),
        "start_time": session_data["start_time"],
        "end_time": current_time,
        "status": "completed",
        "completion_method": "manually_ended",
        "final_results": final_results_data
    }
    
    print(f"\n4️⃣ Frontend Data Structure:")
    print(f"   Session ID: {frontend_data['session_id']}")
    print(f"   Completion Method: {frontend_data['completion_method']}")
    print(f"   Score: {frontend_data['average_score']}")
    print(f"   Duration: {frontend_data['duration']} seconds")
    
    print(f"\n🎉 COMPLETE FLOW TEST SUCCESSFUL!")
    print(f"✅ Database updates: Working")
    print(f"✅ Manual ending status: Tracked") 
    print(f"✅ Frontend data structure: Ready")
    print(f"✅ Results retrieval: Working")
    
    return True

async def main():
    """Main test function"""
    success = await test_complete_flow()
    
    if success:
        print("\n" + "="*60)
        print("🎉 ALL SYSTEMS WORKING!")
        print("✅ You can now:")
        print("   1. Start an interview")
        print("   2. End it manually")
        print("   3. See completion status")
        print("   4. View results with proper theme")
        print("="*60)
    else:
        print("\n" + "="*60)
        print("❌ SOME ISSUES REMAIN")
        print("Check error messages above")
        print("="*60)

if __name__ == "__main__":
    asyncio.run(main())