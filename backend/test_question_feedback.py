#!/usr/bin/env python3
"""
Test to verify question-specific feedback is being stored correctly
"""
import asyncio
from database import db

async def test_question_feedback():
    print("=" * 70)
    print("🧪 Testing Question-Specific Feedback Storage")
    print("=" * 70)
    
    # Get an interview
    interviews = await db.get_all_interviews(limit=5)
    if not interviews:
        print("❌ No interviews found")
        return
    
    print(f"\n✅ Found {len(interviews)} interviews")
    
    for interview in interviews:
        session_id = interview['session_id']
        print(f"\n📊 Interview: {session_id}")
        print(f"   Type: {interview.get('interview_type')}")
        print(f"   Questions completed: {interview.get('completed_questions')}")
        
        # Get question responses
        questions = await db.get_question_responses(session_id)
        
        if not questions:
            print("   ⚠️  No question responses found")
            continue
        
        print(f"   ✅ Found {len(questions)} question responses")
        
        # Check if feedback is different for each question
        feedbacks = [q.get('feedback', '') for q in questions]
        unique_feedbacks = set(feedbacks)
        
        print(f"\n   📝 Feedback Analysis:")
        print(f"      Total questions: {len(questions)}")
        print(f"      Unique feedbacks: {len(unique_feedbacks)}")
        
        if len(unique_feedbacks) == 1 and len(questions) > 1:
            print("      ❌ WARNING: All questions have the SAME feedback!")
            print(f"      Feedback: {feedbacks[0][:100]}...")
        elif len(unique_feedbacks) == len(questions):
            print("      ✅ GOOD: Each question has UNIQUE feedback")
        else:
            print(f"      ⚠️  MIXED: Some questions share feedback")
        
        # Show sample feedbacks
        print(f"\n   🔍 Sample Question Feedbacks:")
        for i, q in enumerate(questions[:3], 1):
            feedback = q.get('feedback', 'No feedback')
            print(f"\n      Q{i} (Score: {q.get('score', 'N/A')}):")
            print(f"      Question: {q.get('question_text', '')[:60]}...")
            print(f"      Feedback: {feedback[:120]}...")
        
        print("\n" + "-" * 70)
    
    print("\n" + "=" * 70)
    print("📊 Test Complete")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(test_question_feedback())
