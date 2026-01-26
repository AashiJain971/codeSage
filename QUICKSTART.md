# CodeSage Authentication - Quick Start Guide

## ⚡ Quick Setup (5 minutes)

### Step 1: Database Setup
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click on your project → SQL Editor
3. Copy the contents of [`backend/SUPABASE_SCHEMA.sql`](backend/SUPABASE_SCHEMA.sql)
4. Paste and click **Run**
5. ✅ Database is ready!

### Step 2: Get Supabase Credentials
1. In Supabase Dashboard → **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **anon/public** key (under "Project API keys")
   - **JWT Secret** (also under "Project API keys")

### Step 3: Backend Setup
```bash
# Navigate to backend
cd backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your credentials:
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_ANON_KEY=your_anon_key
# SUPABASE_JWT_SECRET=your_jwt_secret
# GROQ_API_KEY=your_groq_key
```

### Step 4: Frontend Setup
```bash
# Navigate to frontend
cd ../frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local and add your credentials:
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Step 5: Run the Application
```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate  # If using venv
uvicorn ws_server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Step 6: Test Authentication
1. Visit http://localhost:3000
2. You'll be redirected to `/login`
3. Click **"Sign up"** to create an account
4. Enter email and password (min 6 characters)
5. Check your email for verification (if enabled)
6. Sign in and start an interview!

## 🎯 Key URLs

- **Home/Login**: http://localhost:3000
- **Sign Up**: http://localhost:3000/signup
- **Interviews**: http://localhost:3000/interview
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## ✅ Verify Setup

### Check Backend
```bash
curl http://localhost:8000/health
# Should return: {"status": "healthy", ...}
```

### Check Frontend
1. Open browser DevTools (F12)
2. Go to Console
3. Sign in to your account
4. Look for: `✅ WebSocket authenticated for user: [user-id]`

## 🔧 Configuration Files

### Backend: `backend/.env`
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here
GROQ_API_KEY=your_groq_api_key_here
```

### Frontend: `frontend/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## 🐛 Common Issues

### "Missing authorization header"
**Problem**: Frontend not authenticated  
**Solution**: Make sure you're logged in. Check browser console for auth errors.

### "Invalid token" 
**Problem**: JWT_SECRET mismatch  
**Solution**: Verify `SUPABASE_JWT_SECRET` is identical in backend `.env` and Supabase dashboard.

### "WebSocket closed immediately"
**Problem**: Authentication failed  
**Solution**: 
1. Check you're logged in
2. Verify token is being sent: Check Network tab → WS connection → should have `?token=` in URL
3. Restart backend after changing `.env`

### "Cannot find module '@supabase/supabase-js'"
**Problem**: Frontend dependencies not installed  
**Solution**: `cd frontend && npm install`

### Backend won't start
**Problem**: Missing Python dependencies  
**Solution**: 
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 📱 User Flow

```
1. Visit Site
   ↓
2. Not Logged In? → Redirect to /login
   ↓
3. User Options:
   • Sign In (existing account)
   • Sign Up (create new account)
   ↓
4. After Login → Redirect to /interview
   ↓
5. Start Interview (now linked to user account)
   ↓
6. View Past Interviews (only user's interviews)
```

## 🔐 Security Notes

✅ **Passwords**: Hashed by Supabase Auth (bcrypt)  
✅ **JWTs**: Signed with your project's secret  
✅ **Data**: Isolated per user (can't see others' interviews)  
✅ **Sessions**: Automatic token refresh  
✅ **Logout**: Clears session completely  

## 🚀 Production Deployment

### Additional Steps for Production:

1. **Enable Email Confirmation**
   - Supabase Dashboard → Authentication → Settings
   - Enable "Confirm email" option

2. **Add RLS Policies** (Optional but recommended)
```sql
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own interviews"
ON interviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users create own interviews"
ON interviews FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

3. **Update Environment Variables**
   - Set production URLs in frontend `.env.local`
   - Use production Supabase credentials
   - Never commit `.env` files to git!

## 📚 Additional Documentation

- [Full Setup Guide](AUTH_SETUP.md) - Detailed setup instructions
- [Migration Summary](MIGRATION_SUMMARY.md) - Complete list of changes
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)

---

**Need Help?** Check the troubleshooting section above or review the detailed [AUTH_SETUP.md](AUTH_SETUP.md) guide.
