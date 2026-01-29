#!/usr/bin/env python3
"""
Test the new SWOC/T analysis feature
"""
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

# Test user token (you need to login first or use an existing token)
TOKEN = os.getenv("TEST_TOKEN")

def test_profile_swot():
    """Test that profile API returns SWOC/T analysis"""
    print("=" * 80)
    print("🧪 Testing SWOC/T Analysis in Profile API")
    print("=" * 80)
    
    if not TOKEN:
        print("❌ No TEST_TOKEN found in .env file")
        print("Please add TEST_TOKEN=<your-jwt-token> to .env file")
        print("You can get a token by logging in to the app and checking browser dev tools")
        return
    
    headers = {"Authorization": f"Bearer {TOKEN}"}
    
    print("\n📡 Calling GET /api/profile...")
    response = requests.get(f"{BASE_URL}/api/profile", headers=headers)
    
    if response.status_code != 200:
        print(f"❌ Failed with status {response.status_code}")
        print(f"Response: {response.text}")
        return
    
    data = response.json()
    print("✅ Profile API responded successfully\n")
    
    # Check basic stats
    print("📊 Basic Statistics:")
    print(f"   Total Interviews: {data['stats']['total_interviews']}")
    print(f"   Average Score: {data['stats']['average_score']}%")
    print(f"   Completion Rate: {data['stats']['completion_rate']}%")
    print(f"   Performance Trend: {data['performance']['trend']}")
    print()
    
    # Check if SWOC/T analysis exists
    if 'swot_analysis' not in data:
        print("⚠️  No swot_analysis field in response")
        print("This is expected for users with no interviews or if LLM generation failed")
        return
    
    swot = data['swot_analysis']
    
    if not swot:
        print("⚠️  swot_analysis is null/empty")
        print("This might happen if LLM generation failed")
        return
    
    print("✅ SWOC/T Analysis Found!\n")
    
    # Display Current Stage
    print("🎯 CURRENT STAGE:")
    print(f"   {swot.get('current_stage', 'N/A')}\n")
    
    # Display Longitudinal Growth
    print("📈 GROWTH TRAJECTORY:")
    print(f"   {swot.get('longitudinal_growth', 'N/A')}\n")
    
    # Display Readiness Scores
    if 'technical_readiness' in swot:
        tech = swot['technical_readiness']
        print(f"💻 TECHNICAL READINESS: {tech.get('score', 0)}%")
        print(f"   {tech.get('justification', '')}\n")
    
    if 'behavioral_readiness' in swot:
        behav = swot['behavioral_readiness']
        print(f"🗣️  BEHAVIORAL READINESS: {behav.get('score', 0)}%")
        print(f"   {behav.get('justification', '')}\n")
    
    # Display SWOC/T components
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
    
    # Display Key Recommendations
    print("🎓 KEY RECOMMENDATIONS:")
    for i, rec in enumerate(swot.get('key_recommendations', []), 1):
        print(f"   {i}. {rec}")
    print()
    
    # Display Detailed Breakdown
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
    print("✅ SWOC/T Analysis Test Complete!")
    print("=" * 80)
    
    # Verify all required fields are present
    required_fields = [
        'strengths', 'weaknesses', 'opportunities', 'threats',
        'current_stage', 'longitudinal_growth', 'key_recommendations',
        'technical_readiness', 'behavioral_readiness', 'detailed_breakdown'
    ]
    
    missing_fields = [field for field in required_fields if field not in swot or not swot[field]]
    
    if missing_fields:
        print(f"\n⚠️  Warning: Missing or empty fields: {', '.join(missing_fields)}")
    else:
        print("\n✅ All required SWOC/T fields are present and populated!")
    
    # Save full response for inspection
    with open('test_swot_response.json', 'w') as f:
        json.dump(data, f, indent=2)
    print(f"\n💾 Full response saved to test_swot_response.json")

if __name__ == "__main__":
    test_profile_swot()
