#!/usr/bin/env python3
"""
Test script for Profile API endpoints
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000"

# Create a test JWT token with a user ID
# This is a simple test token - in production, use real Supabase tokens
TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

def test_profile_endpoint():
    """Test the private profile endpoint"""
    print("=" * 60)
    print("Testing GET /api/profile (Private Profile)")
    print("=" * 60)
    
    headers = {
        "Authorization": f"Bearer {TEST_TOKEN}"
    }
    
    response = requests.get(f"{BASE_URL}/api/profile", headers=headers)
    
    print(f"\nStatus Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}\n")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Profile endpoint working!")
        print(f"\nUser ID: {data['user']['id']}")
        print(f"Total Interviews: {data['stats']['total_interviews']}")
        print(f"Average Score: {data['stats']['average_score']}")
        print(f"Trust Score: {data['trustScore']}")
        print(f"Performance Trend: {data['performance']['trend']}")
        print(f"\nSkills:")
        for skill, value in data['skills'].items():
            print(f"  - {skill}: {value}%")
        print(f"\nStrengths: {len(data['strengths'])}")
        for strength in data['strengths'][:3]:
            print(f"  - {strength}")
        print(f"\nImprovements: {len(data['improvements'])}")
        for improvement in data['improvements'][:3]:
            print(f"  - {improvement}")
    else:
        print("❌ Profile endpoint failed!")
        print(f"Error: {response.text}")
    
    return response.status_code == 200

def test_public_profile_endpoint():
    """Test the public profile endpoint"""
    print("\n" + "=" * 60)
    print("Testing GET /api/profile/public/{user_id} (Public Profile)")
    print("=" * 60)
    
    # No authentication needed for public profile
    user_id = "test-user-123"
    response = requests.get(f"{BASE_URL}/api/profile/public/{user_id}")
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Public profile endpoint working!")
        print(f"\nUser ID: {data['user']['id']}")
        print(f"Total Interviews: {data['stats']['total_interviews']}")
        print(f"Average Score: {data['stats']['average_score']}")
        print(f"Trust Score: {data['trustScore']}")
        print(f"Performance Trend: {data['performance']['trend']}")
        print(f"\nSkills:")
        for skill, value in data['skills'].items():
            print(f"  - {skill}: {value}%")
        print(f"\nStrengths: {len(data['strengths'])}")
        for strength in data['strengths'][:3]:
            print(f"  - {strength}")
        
        # Verify sensitive data is not exposed
        assert 'improvements' not in data, "❌ Public profile should not expose improvements"
        assert 'interviews' not in data, "❌ Public profile should not expose detailed interviews"
        print("\n✅ Privacy check passed - no sensitive data in public profile")
    elif response.status_code == 404:
        print("ℹ️  Profile not found (expected for new user)")
    else:
        print("❌ Public profile endpoint failed!")
        print(f"Error: {response.text}")
    
    return response.status_code in [200, 404]

def test_without_auth():
    """Test that private profile requires authentication"""
    print("\n" + "=" * 60)
    print("Testing authentication requirement")
    print("=" * 60)
    
    response = requests.get(f"{BASE_URL}/api/profile")
    
    print(f"\nStatus Code: {response.status_code}")
    
    if response.status_code == 401:
        print("✅ Authentication correctly required for private profile")
        return True
    else:
        print("❌ Private profile should require authentication!")
        return False

if __name__ == "__main__":
    print("\n🧪 CodeSage Profile API Tests\n")
    
    results = []
    
    # Run tests
    results.append(("Private Profile", test_profile_endpoint()))
    results.append(("Public Profile", test_public_profile_endpoint()))
    results.append(("Auth Requirement", test_without_auth()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        exit(1)
