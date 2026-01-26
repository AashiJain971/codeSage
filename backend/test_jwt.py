#!/usr/bin/env python3
"""
Quick test to verify Supabase JWT authentication is working
"""
import os
import jwt
from dotenv import load_dotenv

load_dotenv()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Sample token from your error log (this will be expired but good for testing structure)
sample_token = "eyJhbGciOiJIUzI1NiIsImtpZCI6InYzWkpBZ2d0MXBaVzA0QlAiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NsamtwZmNoZ3VveWFyYWp4aHZjLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIwNTI0MzZhYy04Y2FlLTRiYmEtODQwOS05YTA2Mzc0YjZiYmQiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY5NDQwNDIzLCJpYXQiOjE3Njk0MzY4MjMsImVtYWlsIjoiYWFzaGlqOTcxQGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJhYXNoaWo5NzFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiMDUyNDM2YWMtOGNhZS00YmJhLTg0MDktOWEwNjM3NGI2YmJkIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3Njk0MzY4MjN9XSwic2Vzc2lvbl9pZCI6IjUwYjU0M2ZmLTdjODUtNDQxOC1hMzYxLTc4YmJhNGI5MGQ5MiIsImlzX2Fub255bW91cyI6ZmFsc2V9.TqH1NZDWFVuoux3yWF3Kteb4HkI8QFX0vsriRIkLyWk"

print("=" * 60)
print("SUPABASE JWT AUTHENTICATION TEST")
print("=" * 60)

print(f"\n1. JWT Secret Status:")
if SUPABASE_JWT_SECRET:
    if SUPABASE_JWT_SECRET == "your-jwt-secret-from-supabase-dashboard-settings-api":
        print("   ❌ PLACEHOLDER VALUE - You need to set the real JWT secret!")
        print("   📝 Get it from: https://app.supabase.com/project/sljkpfchguoyarajxhvc/settings/api")
        print("   🔍 Look for 'JWT Secret' in the API settings")
    else:
        print(f"   ✅ JWT Secret is set (length: {len(SUPABASE_JWT_SECRET)} chars)")
else:
    print("   ❌ JWT Secret is NOT set in .env file")
    print("   📝 Add SUPABASE_JWT_SECRET to your backend/.env file")

print(f"\n2. Testing Token Decode (without verification):")
try:
    # Decode without verification to see token structure
    decoded = jwt.decode(sample_token, options={"verify_signature": False})
    print(f"   ✅ Token structure is valid")
    print(f"   📧 Email: {decoded.get('email')}")
    print(f"   🆔 User ID: {decoded.get('sub')}")
    print(f"   👤 Role: {decoded.get('role')}")
except Exception as e:
    print(f"   ❌ Error: {e}")

if SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET != "your-jwt-secret-from-supabase-dashboard-settings-api":
    print(f"\n3. Testing Token Verification (with secret):")
    try:
        # Try to verify with the secret
        decoded = jwt.decode(
            sample_token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        print(f"   ✅ Token verification SUCCESSFUL!")
        print(f"   🎉 Your JWT secret is correct!")
    except jwt.ExpiredSignatureError:
        print(f"   ⏰ Token is expired (this is expected for old tokens)")
        print(f"   ✅ But verification logic works! Your secret is correct.")
    except jwt.InvalidSignatureError:
        print(f"   ❌ INVALID SIGNATURE - Your JWT secret is wrong!")
        print(f"   📝 Double-check the secret from Supabase dashboard")
    except Exception as e:
        print(f"   ❌ Error: {e}")
else:
    print(f"\n3. Skipping verification test (secret not set)")

print("\n" + "=" * 60)
print("NEXT STEPS:")
print("=" * 60)
if not SUPABASE_JWT_SECRET or SUPABASE_JWT_SECRET == "your-jwt-secret-from-supabase-dashboard-settings-api":
    print("1. Go to: https://app.supabase.com/project/sljkpfchguoyarajxhvc/settings/api")
    print("2. Scroll to 'JWT Settings'")
    print("3. Copy the JWT Secret")
    print("4. Update backend/.env:")
    print('   SUPABASE_JWT_SECRET="paste-your-secret-here"')
    print("5. Restart the backend server")
else:
    print("✅ JWT authentication should be working!")
    print("🔄 If you still see errors, restart the backend server:")
    print("   cd backend && uvicorn ws_server:app --reload")
print("=" * 60)
