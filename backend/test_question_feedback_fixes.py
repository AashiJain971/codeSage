#!/usr/bin/env python3
"""
Test to verify the fixes for:
1. Specific question generation (not vague)
2. Proper feedback for boilerplate/empty submissions
"""
import asyncio
import sys
sys.path.insert(0, '/Users/adityajain/codeSageNew/backend')

from ws_server import generate_technical_question, TechnicalSession, llm_evaluate_code_submission

def test_question_generation():
    """Test that questions are specific, not vague"""
    print("=" * 70)
    print("🧪 Test 1: Question Generation Quality")
    print("=" * 70)
    
    topics_to_test = [
        (["Graphs"], "hard"),
        (["Arrays"], "medium"),
        (["Dynamic Programming"], "hard")
    ]
    
    for topics, difficulty in topics_to_test:
        print(f"\n📋 Generating {difficulty} question for {topics}...")
        question = generate_technical_question(topics, difficulty)
        
        question_text = question.get("question", "")
        print(f"\n✅ Generated Question:")
        print(f"   {question_text}")
        
        # Check if question is vague (bad patterns)
        vague_patterns = [
            "solve a problem related to",
            "solve a hard problem",
            "solve a medium problem",
            "solve a easy problem",
            "write a function to solve"
        ]
        
        is_vague = any(pattern.lower() in question_text.lower() for pattern in vague_patterns)
        
        if is_vague:
            print(f"\n   ❌ VAGUE QUESTION DETECTED!")
            print(f"   This is too generic and needs improvement")
        else:
            print(f"\n   ✅ GOOD: Question is specific and detailed")
        
        # Check length - specific questions should be reasonably detailed
        if len(question_text) < 50:
            print(f"   ⚠️  Question might be too short ({len(question_text)} chars)")
        else:
            print(f"   ✅ Good length ({len(question_text)} chars)")
        
        print("-" * 70)

async def test_boilerplate_feedback():
    """Test that boilerplate submissions get proper feedback"""
    print("\n" + "=" * 70)
    print("🧪 Test 2: Boilerplate Code Feedback")
    print("=" * 70)
    
    # Create a mock session
    session = TechnicalSession("test-session", "test-user-123")
    session.questions = [{
        "question": "Implement a function to reverse a linked list",
        "difficulty": "medium",
        "topics": ["Linked Lists"]
    }]
    session.current_question_index = 0
    
    # Test with boilerplate code
    boilerplate_code = """# Write your solution here
def solution():
    pass

if __name__ == "__main__":
    result = solution()
    print(result)
"""
    
    print(f"\n📝 Testing with boilerplate code:")
    print(f"{boilerplate_code}")
    
    score = await llm_evaluate_code_submission(session, boilerplate_code, "python", 5000, 0)
    
    print(f"\n📊 Score: {score}/100")
    
    if score == 0:
        print("✅ Score is correctly 0 for boilerplate")
    else:
        print(f"❌ Expected score 0, got {score}")
    
    # Check feedback
    if hasattr(session, 'final_evaluation') and session.final_evaluation:
        feedback = session.final_evaluation.get('feedback', '')
        print(f"\n💬 AI Feedback:")
        print(f"   {feedback}")
        
        # Check if feedback is appropriate for boilerplate
        if "boilerplate" in feedback.lower() or "template" in feedback.lower() or "no solution" in feedback.lower():
            print(f"\n   ✅ GOOD: Feedback correctly identifies boilerplate code")
        else:
            print(f"\n   ❌ BAD: Feedback doesn't mention boilerplate/template issue")
            print(f"   Feedback says: {feedback}")
        
        # Check that feedback doesn't mention wrong algorithms
        wrong_algorithms = ["dijkstra", "dfs", "bfs", "dynamic programming"]
        mentions_wrong_algo = any(algo in feedback.lower() for algo in wrong_algorithms)
        
        if mentions_wrong_algo:
            print(f"\n   ❌ CRITICAL BUG: Feedback mentions algorithms not in the code!")
        else:
            print(f"\n   ✅ GOOD: Feedback doesn't mention irrelevant algorithms")
    else:
        print(f"\n❌ No feedback set for boilerplate code!")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    # Test 1: Question Generation
    test_question_generation()
    
    # Test 2: Boilerplate Feedback
    print("\n")
    asyncio.run(test_boilerplate_feedback())
    
    print("\n" + "=" * 70)
    print("✅ All tests complete!")
    print("=" * 70)
