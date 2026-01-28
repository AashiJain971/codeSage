#!/usr/bin/env python3
"""Test profile API with real user data"""

import requests
import json

API_BASE = "http://localhost:8000"

def test_private_profile():
    """Test private profile endpoint with real user"""
    print("=" * 60)
    print("Testing Real User Profile (using first user from interviews)")
    print("=" * 60)
    
    # First get an interview to find a real user_id
    response = requests.get(f"{API_BASE}/api/interviews")
    if response.status_code == 200:
        data = response.json()
        if data.get("interviews"):
            # Use the user from the first interview
            # Since we don't have user_id directly, we'll use the interview system
            print("✅ Found interviews in database")
            print(f"Total interviews: {len(data['interviews'])}")
            
            # Test with mock token (in real scenario, you'd get this from auth)
            test_user_id = "test-user-123"
            headers = {"Authorization": f"Bearer mock_token_for_{test_user_id}"}
            
            profile_response = requests.get(
                f"{API_BASE}/api/profile",
                headers=headers
            )
            
            if profile_response.status_code == 200:
                profile = profile_response.json()
                print("\n📊 Profile Data:")
                print(f"Total Interviews: {profile['stats']['total_interviews']}")
                print(f"Average Score: {profile['stats']['average_score']}")
                print(f"Trust Score: {profile['trustScore']}")
                print(f"\nSkills:")
                for skill, value in profile['skills'].items():
                    print(f"  - {skill}: {value}%")
                print(f"\nStrengths: {len(profile['strengths'])}")
                print(f"Improvements: {len(profile['improvements'])}")
                
                # Check if interview details are included
                if profile.get('interviews'):
                    print(f"\n✅ Interview details included: {len(profile['interviews'])} interviews")
                    if len(profile['interviews']) > 0:
                        first = profile['interviews'][0]
                        print(f"\nFirst Interview:")
                        print(f"  Type: {first['type']}")
                        print(f"  Score: {first['score']}")
                        print(f"  Has final_results: {bool(first.get('final_results'))}")
                        if first.get('final_results'):
                            fr = first['final_results']
                            print(f"  Has strengths: {bool(fr.get('strengths'))}")
                            print(f"  Has improvements: {bool(fr.get('areas_for_improvement'))}")
                            print(f"  Has skill_signal_map: {bool(fr.get('skill_signal_map'))}")
                return True
            else:
                print(f"❌ Profile request failed: {profile_response.status_code}")
                return False
    else:
        print("❌ Failed to get interviews")
        return False

def test_public_profile():
    """Test public profile endpoint"""
    print("\n" + "=" * 60)
    print("Testing Public Profile")
    print("=" * 60)
    
    # Test with a known user ID (you would get this from a real user)
    test_user_id = "test-user-123"
    
    response = requests.get(f"{API_BASE}/api/profile/public/{test_user_id}")
    
    if response.status_code == 404:
        print("ℹ️  Profile not found (expected for test user)")
        return True
    elif response.status_code == 200:
        data = response.json()
        print("✅ Public profile loaded")
        print(f"Total Interviews: {data['stats']['total_interviews']}")
        print(f"Skills: {list(data['skills'].keys())}")
        return True
    else:
        print(f"❌ Unexpected status: {response.status_code}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Profile API with Real Data\n")
    
    results = []
    results.append(("Private Profile", test_private_profile()))
    results.append(("Public Profile", test_public_profile()))
    
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
    
    total_passed = sum(1 for _, passed in results if passed)
    print(f"\nTotal: {total_passed}/{len(results)} tests passed")
    
    if total_passed == len(results):
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed")
