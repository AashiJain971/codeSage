# CodeSage Authentication Setup Guide

## ✅ What's Already Done

1. **Frontend environment file created**: `frontend/.env.local`
2. **Backend environment file updated**: `backend/.env` 
3. **Authentication flow complete**:
   - Home page requires login
   - Login/signup pages redirect if already authenticated
   - All interview pages protected with authentication
   - Past interviews filtered by user ID
   - Sign out functionality in navbar

## 🔧 Required: Get Your JWT Secret

You need to add your Supabase JWT secret to the backend `.env` file:

### Steps:

1. **Go to Supabase Dashboard**:
   - Visit: https://sljkpfchguoyarajxhvc.supabase.co
   - Or go to: https://app.supabase.com

2. **Navigate to Settings**:
   - Click on the **Settings** icon (gear icon) in the left sidebar
   - Go to **API** section

3. **Copy JWT Secret**:
   - Scroll down to **JWT Settings**
   - Find **JWT Secret** (it's a long string)
   - Click to reveal and copy it

4. **Update Backend `.env`**:
   - Open: `backend/.env`
   - Replace this line:
     ```
     SUPABASE_JWT_SECRET="your-jwt-secret-from-supabase-dashboard-settings-api"
     ```
   - With:
     ```
     SUPABASE_JWT_SECRET="your-actual-jwt-secret-here"
     ```

## 🚀 Running the Application

### Terminal 1 - Backend:
```bash
cd backend
# Install dependencies if not done
pip install -r requirements.txt
# Or if using virtual environment:
# source venv/bin/activate && pip install -r requirements.txt

# Start backend server
uvicorn ws_server:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

## 🔐 Authentication Flow

1. **First Visit**: User is redirected to `/login`
2. **Sign Up**: New users can create account at `/signup`
3. **Login**: Existing users sign in at `/login`
4. **Home Page**: After login, users see the CodeSage home page with typewriter intro
5. **Protected Routes**:
   - `/interview` - Take new interview (requires auth)
   - `/interview/technical` - Technical interview (requires auth)
   - `/interview/resume` - Resume-based interview (requires auth)
   - `/past-interviews` - View user's past interviews only (requires auth)

## 🛡️ Security Features

- ✅ JWT token-based authentication
- ✅ Bearer token in API requests
- ✅ Token passed as query parameter for WebSocket connections
- ✅ User ID associated with all interviews
- ✅ Backend filters interviews by authenticated user
- ✅ Protected routes on frontend
- ✅ Automatic redirect if not authenticated

## 📝 Test the Flow

1. **Start both servers** (backend & frontend)
2. **Visit**: http://localhost:3000
3. **You should be redirected to**: http://localhost:3000/login
4. **Create account**: Click "Create Account" → Sign up
5. **Login**: Sign in with your credentials
6. **Home page**: See the CodeSage welcome
7. **Take interview**: All interview features now work
8. **Past interviews**: Only shows YOUR interviews
9. **Sign out**: Click "Sign Out" in navbar → Redirects to login

## 🐛 Troubleshooting

### Frontend won't start:
```bash
cd frontend
rm -rf .next node_modules
npm install
npm run dev
```

### Backend authentication errors:
- Make sure `SUPABASE_JWT_SECRET` is set in `backend/.env`
- Restart backend server after adding JWT secret

### "Missing Supabase environment variables" error:
- Check `frontend/.env.local` exists and has correct values
- Restart frontend dev server

### Can't create account:
- Check Supabase dashboard → Authentication → Settings
- Ensure email confirmations are disabled (or check your email)

## 📧 Email Confirmation (Optional)

By default, Supabase may require email confirmation. To disable:

1. Go to: https://app.supabase.com
2. Select your project
3. Go to: **Authentication** → **Settings**
4. Under **Email Auth**, toggle **Enable email confirmations** to **OFF**

This allows instant sign-up without waiting for email verification.

## ✨ Summary

Your authentication system is now fully configured! Users must:
1. Login first
2. Can only see their own interviews
3. All WebSocket and API calls are authenticated
4. Clean logout redirects to login page

Just add the JWT secret from Supabase and you're ready to go! 🚀
