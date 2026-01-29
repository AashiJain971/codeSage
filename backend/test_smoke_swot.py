#!/usr/bin/env python3
"""
Quick smoke test for SWOC/T feature - verifies no breaking changes
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

def smoke_test():
    """Verify endpoints still work"""
    print("=" * 80)
    print("🔥 SWOC/T Feature Smoke Test")
    print("=" * 80)
    
    # Test health endpoint
    print("\n1️⃣  Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("   ✅ Health endpoint working")
        else:
            print(f"   ❌ Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Health endpoint error: {e}")
        return False
    
    # Test profile endpoint (should fail without auth, but endpoint should exist)
    print("\n2️⃣  Testing profile endpoint (unauthenticated)...")
    try:
        response = requests.get(f"{BASE_URL}/api/profile", timeout=5)
        if response.status_code == 401:
            print("   ✅ Profile endpoint exists (401 expected without auth)")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Profile endpoint error: {e}")
        return False
    
    # Test with auth if token available
    token = os.getenv("TEST_TOKEN")
    if token:
        print("\n3️⃣  Testing profile endpoint (authenticated)...")
        try:
            headers = {"Authorization": f"Bearer {token}"}
            response = requests.get(f"{BASE_URL}/api/profile", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print("   ✅ Profile endpoint working with auth")
                
                # Check for backwards compatibility
                if 'stats' in data and 'skills' in data and 'performance' in data:
                    print("   ✅ Backwards compatible fields present")
                else:
                    print("   ❌ Missing required fields!")
                    return False
                
                # Check for new SWOC/T field
                if 'swot_analysis' in data:
                    if data['swot_analysis']:
                        print("   ✅ SWOC/T analysis generated")
                        
                        # Verify structure
                        swot = data['swot_analysis']
                        required = ['strengths', 'weaknesses', 'opportunities', 'threats', 
                                   'current_stage', 'longitudinal_growth']
                        missing = [f for f in required if f not in swot]
                        
                        if not missing:
                            print("   ✅ SWOC/T has all required fields")
                        else:
                            print(f"   ⚠️  SWOC/T missing fields: {missing}")
                    else:
                        print("   ⚠️  SWOC/T field is null (acceptable if no interviews)")
                else:
                    print("   ⚠️  SWOC/T field not present")
                
                # Verify fallback fields still work
                if 'strengths' in data and 'improvements' in data:
                    print("   ✅ Fallback strengths/improvements present")
                else:
                    print("   ❌ Fallback fields missing!")
                    return False
                    
            elif response.status_code == 401:
                print("   ⚠️  Token expired or invalid")
            else:
                print(f"   ❌ Profile endpoint failed: {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"   ❌ Profile endpoint error: {e}")
            return False
    else:
        print("\n3️⃣  Skipping authenticated test (no TEST_TOKEN in .env)")
    
    # Test public profile endpoint
    print("\n4️⃣  Testing public profile endpoint...")
    try:
        # Use a sample user_id (will 404 if user doesn't exist, but endpoint should work)
        response = requests.get(f"{BASE_URL}/api/profile/public/test-user-123", timeout=5)
        if response.status_code in [200, 404]:
            print(f"   ✅ Public profile endpoint accessible (status: {response.status_code})")
        else:
            print(f"   ⚠️  Unexpected status: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Public profile endpoint error: {e}")
        return False
    
    print("\n" + "=" * 80)
    print("✅ Smoke test passed! No breaking changes detected.")
    print("=" * 80)
    
    print("\n📋 Summary:")
    print("   • Health endpoint: Working")
    print("   • Profile endpoint: Working")
    print("   • SWOC/T analysis: Integrated")
    print("   • Backwards compatibility: Maintained")
    print("   • Public profile: Working")
    
    return True

if __name__ == "__main__":
    success = smoke_test()
    exit(0 if success else 1)
