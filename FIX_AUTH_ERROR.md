# 🔧 FIX: Authentication Errors - JWT Secret Required

## ❌ Current Issue

The error `NameError: name 'user_id' is not defined` occurs because:
1. The JWT secret in `backend/.env` is a placeholder
2. Without the real secret, token verification fails
3. So `user_id` never gets extracted from the token

## ✅ Solution: Add Real JWT Secret

### Step 1: Get JWT Secret from Supabase

1. **Open Supabase Dashboard**:
   - Go to: https://app.supabase.com/project/sljkpfchguoyarajxhvc/settings/api
   - Or navigate: https://app.supabase.com → Select your project → Settings (gear icon) → API

2. **Find JWT Secret**:
   - Scroll down to **"JWT Settings"** section
   - Look for **"JWT Secret"** field
   - Click the eye icon to reveal the secret
   - Copy the entire secret string

3. **Update Backend .env**:
   ```bash
   # Open the file
   nano /Users/adityajain/codeSageNew/backend/.env
   
   # Or use VS Code
   code /Users/adityajain/codeSageNew/backend/.env
   ```

4. **Replace the placeholder**:
   ```env
   # BEFORE (current):
   SUPABASE_JWT_SECRET="your-jwt-secret-from-supabase-dashboard-settings-api"
   
   # AFTER (paste your real secret):
   SUPABASE_JWT_SECRET="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Your actual secret here
   ```

5. **Save the file** (Ctrl+S or :wq in nano)

### Step 2: Restart Backend Server

Kill the current server and restart:

```bash
# In the terminal running the backend (Ctrl+C to stop)
# Then restart:
cd /Users/adityajain/codeSageNew/backend
uvicorn ws_server:app --host 127.0.0.1 --port 8000 --reload
```

### Step 3: Test Authentication

```bash
# Run the test script
cd /Users/adityajain/codeSageNew/backend
python3 test_jwt.py
```

You should see:
```
✅ JWT Secret is set
✅ Token verification SUCCESSFUL!
🎉 Your JWT secret is correct!
```

## 🔍 What Was Fixed

1. **Technical Interview WebSocket** (`/ws/technical`):
   - ✅ Added JWT authentication
   - ✅ Extracts `user_id` from token
   - ✅ Associates all interviews with logged-in user

2. **Resume Interview WebSocket** (`/ws`):
   - ✅ Already had JWT authentication
   - ✅ Working once secret is set

3. **Frontend**:
   - ✅ Both interview types send token in WebSocket URL
   - ✅ Using `getAuthenticatedWsUrl(token, path)`

## 🧪 Testing the Complete Flow

After adding the JWT secret and restarting:

### Test 1: Resume Interview
```bash
1. Open http://localhost:3000
2. Login with your account
3. Go to "Take Interview" → "Resume-Based Interview"
4. Upload a PDF resume
5. Start the interview
```

**Expected**: WebSocket connects, interview starts, questions are asked

### Test 2: Technical Interview
```bash
1. From home page
2. Go to "Take Interview" → "Technical Interview"
3. Select topics (e.g., Arrays, Strings)
4. Click "Start Interview"
```

**Expected**: WebSocket connects, greeting plays, first question appears

### Test 3: Past Interviews
```bash
1. Complete an interview (either type)
2. Go to "Past Interviews"
```

**Expected**: Only YOUR interviews show up, filtered by your user ID

## 🐛 Troubleshooting

### "Authentication failed" error
- Double-check the JWT secret is copied correctly (no extra spaces)
- Make sure you restarted the backend server after updating .env

### "Token expired" error
- This is normal - just refresh the page to get a new token
- Frontend automatically handles token refresh

### Resume interview still not connecting
- Check browser console (F12) for errors
- Verify WebSocket URL includes `?token=...`
- Make sure backend server is running on port 8000

### Still seeing errors in backend logs
```bash
# Check if .env is loaded properly
cd /Users/adityajain/codeSageNew/backend
python3 -c "from dotenv import load_dotenv; import os; load_dotenv(); print('JWT Secret length:', len(os.getenv('SUPABASE_JWT_SECRET', '')))"
```

Should show: `JWT Secret length: 64` (or similar, not 0 or 58)

## 📝 Quick Reference

**JWT Secret Location**: 
- Supabase Dashboard → Settings → API → JWT Settings → JWT Secret

**Backend .env location**: 
- `/Users/adityajain/codeSageNew/backend/.env`

**Restart backend**: 
- `Ctrl+C` in Python terminal → `uvicorn ws_server:app --reload`

**Frontend location**: 
- http://localhost:3000

## ✨ What Happens After This Fix

1. ✅ Users must login before any interview
2. ✅ All interviews are linked to their user account
3. ✅ WebSocket authentication works for both interview types
4. ✅ Past interviews show only user-specific data
5. ✅ Secure JWT-based authentication throughout the app

---

**Once you add the JWT secret, everything should work perfectly!** 🚀
