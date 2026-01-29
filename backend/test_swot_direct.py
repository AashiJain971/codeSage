#!/usr/bin/env python3
"""
Direct test of SWOC/T analysis generation
"""
import asyncio
import sys
sys.path.insert(0, '/Users/adityajain/codeSageNew/backend')

from ws_server import generate_swot_analysis

async def test_swot_generation():
    """Test SWOC/T generation with sample data"""
    print("=" * 80)
    print("🧪 Testing SWOC/T Analysis Generation")
    print("=" * 80)
    
    # Sample interview data
    completed_interviews = [
        {
            "type": "technical",
            "date": "2026-01-20",
            "score": 75,
            "topics": ["Arrays", "Strings"],
            "duration_seconds": 1800,
            "questions_completed": 3,
            "total_questions": 3,
            "final_results": {
                "feedback": "Good problem-solving approach, needs work on edge cases"
            }
        },
        {
            "type": "technical",
            "date": "2026-01-22",
            "score": 82,
            "topics": ["Graphs", "Dynamic Programming"],
            "duration_seconds": 2100,
            "questions_completed": 3,
            "total_questions": 3,
            "final_results": {
                "feedback": "Excellent code quality and communication"
            }
        },
        {
            "type": "resume",
            "date": "2026-01-25",
            "score": 70,
            "topics": ["Behavioral"],
            "duration_seconds": 1500,
            "questions_completed": 5,
            "total_questions": 5,
            "final_results": {
                "feedback": "Good STAR method usage, could elaborate more on technical leadership"
            }
        },
        {
            "type": "technical",
            "date": "2026-01-28",
            "score": 88,
            "topics": ["Trees", "Recursion"],
            "duration_seconds": 1900,
            "questions_completed": 3,
            "total_questions": 3,
            "final_results": {
                "feedback": "Strong performance across all areas"
            }
        }
    ]
    
    skills = {
        "problem_solving": 78.5,
        "communication": 72.3,
        "code_quality": 81.2,
        "technical_depth": 75.8,
        "system_design": 65.4,
        "behavioral": 68.7
    }
    
    stats = {
        "total_interviews": 4,
        "average_score": 78.75,
        "completion_rate": 100.0,
        "trend": "improving",
        "total_questions": 14
    }
    
    print("\n📊 Input Data:")
    print(f"   Total Interviews: {stats['total_interviews']}")
    print(f"   Average Score: {stats['average_score']}%")
    print(f"   Trend: {stats['trend']}")
    print(f"   Skills: {skills}")
    print()
    
    print("🔄 Generating SWOC/T analysis with LLM...")
    swot = await generate_swot_analysis(
        completed_interviews=completed_interviews,
        skills=skills,
        stats=stats,
        interview_list=completed_interviews
    )
    
    if not swot:
        print("❌ Failed to generate SWOC/T analysis")
        print("This could be due to:")
        print("  - Groq API key not configured")
        print("  - LLM service unavailable")
        print("  - JSON parsing error")
        return
    
    print("✅ SWOC/T Analysis Generated!\n")
    
    # Display results
    print("=" * 80)
    print("🎯 CURRENT STAGE:")
    print(f"   {swot.get('current_stage', 'N/A')}\n")
    
    print("📈 GROWTH TRAJECTORY:")
    print(f"   {swot.get('longitudinal_growth', 'N/A')}\n")
    
    print("💻 TECHNICAL READINESS:")
    if 'technical_readiness' in swot:
        tech = swot['technical_readiness']
        print(f"   Score: {tech.get('score', 0)}%")
        print(f"   {tech.get('justification', '')}\n")
    
    print("🗣️  BEHAVIORAL READINESS:")
    if 'behavioral_readiness' in swot:
        behav = swot['behavioral_readiness']
        print(f"   Score: {behav.get('score', 0)}%")
        print(f"   {behav.get('justification', '')}\n")
    
    print("💪 STRENGTHS:")
    for i, strength in enumerate(swot.get('strengths', []), 1):
        print(f"   {i}. {strength}")
    print()
    
    print("⚠️  WEAKNESSES:")
    for i, weakness in enumerate(swot.get('weaknesses', []), 1):
        print(f"   {i}. {weakness}")
    print()
    
    print("⚡ OPPORTUNITIES:")
    for i, opp in enumerate(swot.get('opportunities', []), 1):
        print(f"   {i}. {opp}")
    print()
    
    print("🛡️  CHALLENGES/THREATS:")
    for i, threat in enumerate(swot.get('threats', []), 1):
        print(f"   {i}. {threat}")
    print()
    
    print("🎓 KEY RECOMMENDATIONS:")
    for i, rec in enumerate(swot.get('key_recommendations', []), 1):
        print(f"   {i}. {rec}")
    print()
    
    if 'detailed_breakdown' in swot:
        print("📊 DETAILED COMPETENCY BREAKDOWN:")
        breakdown = swot['detailed_breakdown']
        for category, details in breakdown.items():
            score = details.get('score', 0)
            assessment = details.get('assessment', '')
            print(f"\n   {category.replace('_', ' ').upper()}: {score}%")
            print(f"   └─ {assessment}")
    print()
    
    print("=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)
    
    # Verify structure
    required_fields = [
        'strengths', 'weaknesses', 'opportunities', 'threats',
        'current_stage', 'longitudinal_growth', 'key_recommendations',
        'technical_readiness', 'behavioral_readiness', 'detailed_breakdown'
    ]
    
    missing = [f for f in required_fields if f not in swot or not swot[f]]
    if missing:
        print(f"\n⚠️  Missing fields: {', '.join(missing)}")
    else:
        print("\n✅ All required fields present!")
    
    # Check quality
    checks = {
        "At least 4 strengths": len(swot.get('strengths', [])) >= 4,
        "At least 4 weaknesses": len(swot.get('weaknesses', [])) >= 4,
        "At least 4 opportunities": len(swot.get('opportunities', [])) >= 4,
        "At least 4 threats": len(swot.get('threats', [])) >= 4,
        "At least 3 recommendations": len(swot.get('key_recommendations', [])) >= 3,
        "Has detailed breakdown": 'detailed_breakdown' in swot and len(swot['detailed_breakdown']) >= 6
    }
    
    print("\n🔍 Quality Checks:")
    for check, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {check}")

if __name__ == "__main__":
    asyncio.run(test_swot_generation())
