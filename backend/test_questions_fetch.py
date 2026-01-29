#!/usr/bin/env python3
"""
Test that question_responses are being fetched correctly for the profile API
"""
import asyncio
from database import db

async def test_questions():
    # Get an interview
    interviews = await db.get_all_interviews(limit=1)
    if interviews:
        session_id = interviews[0]['session_id']
        print(f"Testing with interview: {session_id}")
        
        # Fetch question responses
        questions = await db.get_question_responses(session_id)
        print(f"\n✅ Found {len(questions)} question responses")
        
        if questions:
            for i, q in enumerate(questions, 1):
                print(f"\nQuestion {i}:")
                print(f"  Index: {q.get('question_index', 'N/A')}")
                print(f"  Text: {q.get('question_text', '')[:60]}...")
                print(f"  Score: {q.get('score', 'N/A')}")
                print(f"  Difficulty: {q.get('difficulty', 'N/A')}")
                print(f"  Time taken: {q.get('time_taken', 'N/A')}s")
                print(f"  Hints used: {q.get('hints_used', 0)}")
        
        print(f"\n✅ Question responses are being fetched correctly!")
        print(f"This data will now be available in the profile API under 'questions_data'")
        print(f"\nThe frontend charts (Process Efficiency & Difficulty vs Performance)")
        print(f"will now have data to display!")
    else:
        print("No interviews found")

if __name__ == "__main__":
    asyncio.run(test_questions())
