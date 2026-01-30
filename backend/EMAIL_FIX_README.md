# 🔧 Email Display Fix for Public Profiles

## Problem
The email address was not showing on public profiles when users had 0 interviews because:
1. The Supabase admin API was returning a 403 "User not allowed" error
2. There was no fallback mechanism to retrieve the email

## Solution
Store the user's email in the `user_profiles` table so it can be retrieved for public profiles without needing admin API access.

## Changes Made

### 1. Database Migration
Added an `email` column to the `user_profiles` table:
- **File**: `migrations/add_email_to_user_profiles.sql`
- **Changes**: 
  - Adds `email TEXT` column
  - Creates index for faster lookups

### 2. Database Functions (database.py)
Updated functions to store and retrieve emails:
- **`update_user_profile_cache()`**: Now accepts optional `email` parameter and stores it
- **`store_user_email()`**: New function to store user email in user_profiles table
- **`get_user_profile_cache()`**: Returns email along with other profile data

### 3. Authentication Middleware (auth_middleware.py)
Modified to extract and store email from JWT tokens:
- **`verify_token()`**: Extracts email from JWT payload and stores it in user_profiles
- This ensures email is captured whenever a user makes an authenticated request

### 4. Public Profile Endpoint (ws_server.py)
Updated to use email from user_profiles as fallback:
- First tries to get email from Supabase auth admin API
- If that fails, falls back to email stored in user_profiles table
- This ensures email is visible even when admin API access fails

## How to Apply

### Step 1: Run the Database Migration

**Option A: Using Supabase Dashboard (Recommended)**
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `migrations/add_email_to_user_profiles.sql`
4. Paste and click "Run"

**Option B: Using the migration script**
```bash
cd backend
python3 run_email_column_migration.py
# Follow the on-screen instructions
```

### Step 2: Restart the Backend Server
The backend will automatically start storing emails when users authenticate.

```bash
# If running locally
cd backend
# Stop the current server (Ctrl+C) and restart:
uvicorn ws_server:app --reload
```

### Step 3: Test
1. Log in to your application
2. View your public profile (even with 0 interviews)
3. The email should now be visible

## How It Works

### Flow Diagram
```
User Logs In
    ↓
JWT Token Decoded → Email Extracted
    ↓
Email Stored in user_profiles Table
    ↓
Public Profile Request
    ↓
Try: Get Email from Auth Admin API
    ↓ (if fails)
Fallback: Get Email from user_profiles Table
    ↓
Email Displayed on Public Profile ✅
```

## Testing

### Test with 0 Interviews
1. Create a new account or use an account with no interviews
2. Navigate to the public profile page
3. Email should be visible

### Test with Multiple Interviews
1. Complete some interviews
2. Check public profile
3. Email should still be visible

## Troubleshooting

### Email still not showing?
1. **Check if migration ran**: Query the database to see if the `email` column exists:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'user_profiles' AND column_name = 'email';
   ```

2. **Check if email is being stored**: After logging in, check the user_profiles table:
   ```sql
   SELECT user_id, email, created_at FROM user_profiles LIMIT 5;
   ```

3. **Check server logs**: Look for these messages:
   - "✅ Stored email for user X in user_profiles"
   - "✅ Found user email from user_profiles"

### Permission errors?
If you see "permission denied" errors when storing emails, disable RLS on user_profiles:
```sql
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
```

## Files Changed
- `backend/migrations/add_email_to_user_profiles.sql` - New migration file
- `backend/database.py` - Updated profile cache functions
- `backend/auth_middleware.py` - Added email extraction from JWT
- `backend/ws_server.py` - Updated public profile endpoint
- `backend/run_email_column_migration.py` - Migration runner script
- `backend/run_email_migration.sh` - Shell script helper
- `backend/EMAIL_FIX_README.md` - This file

## Next Steps
The email will now be:
1. Automatically stored when users log in
2. Retrieved from user_profiles for public profiles
3. Visible even when users have 0 interviews

✅ Email display issue fixed!
