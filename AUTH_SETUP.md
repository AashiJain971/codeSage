# CodeSage Authentication Setup Guide

## Overview
CodeSage now requires authentication before accessing any interviews. All interviews are associated with authenticated users.

## Database Changes

### Schema Updates
- Added `user_id UUID NOT NULL` column to `interviews` table
- `user_id` references `auth.users(id)` with CASCADE delete
- Created index on `user_id` for performance

### Migration Required
Run the updated `SUPABASE_SCHEMA.sql` in your Supabase SQL Editor to apply changes.

## Backend Setup

### Environment Variables Required
Add to `/backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret
GROQ_API_KEY=your_groq_api_key
```

**Finding SUPABASE_JWT_SECRET:**
1. Go to Supabase Dashboard → Settings → API
2. Look for "JWT Secret" under Project API keys
3. Copy the secret value

### Dependencies
Install new dependencies:
```bash
cd backend
pip install PyJWT==2.8.0
```

### Key Changes
- `auth_middleware.py`: JWT token verification
- `database.py`: `create_interview_session()` now requires `user_id`
- `api.py`: All endpoints require authentication via `Depends(get_current_user)`
- `ws_server.py`: WebSocket connections verify JWT from query parameter

## Frontend Setup

### Environment Variables Required
Add to `/frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Dependencies
Install new dependencies:
```bash
cd frontend
npm install @supabase/supabase-js
```

### Key Changes
- `AuthContext.tsx`: Manages authentication state globally
- `login/page.tsx`: Email/password login
- `signup/page.tsx`: User registration
- `ProtectedRoute.tsx`: Route protection wrapper
- All interview pages: Require authentication before connecting

## User Flow

### Before Authentication
1. User visits site → Redirected to `/login`
2. User can either:
   - Sign in with existing account
   - Create new account at `/signup`

### After Authentication
1. User completes login
2. Redirected to `/interview` or original destination
3. All interviews are linked to their user account
4. Can view only their own past interviews

### WebSocket Authentication
WebSocket connections include auth token as query parameter:
```javascript
const token = await getToken();
const wsUrl = `wss://backend.com/ws?token=${token}`;
```

## Security Features

1. **JWT Verification**: All backend endpoints verify JWT signature
2. **User Isolation**: Users can only access their own interviews
3. **Token-based WS**: WebSocket connections validate token before allowing connection
4. **Automatic Logout**: Session expires when token expires

## Testing

### Create Test User
1. Visit `/signup`
2. Enter email and password (min 6 characters)
3. Check email for verification link (if email confirmation enabled)
4. Sign in at `/login`

### Verify Authentication
1. Open browser DevTools → Console
2. Check for authentication logs:
   - "✅ WebSocket authenticated for user: [user_id]"
   - "✅ Database record created with user_id"

## Rollback Plan

If issues arise, temporarily disable auth by:
1. Commenting out `Depends(get_current_user)` in API endpoints
2. Removing `user_id` requirement from WebSocket handler
3. Using a default `user_id` in database operations

**Note:** This is NOT recommended for production!

## Common Issues

### "Missing authorization header"
- Frontend not sending auth token
- Check `getToken()` is awaited before API calls

### "Invalid token"
- JWT_SECRET mismatch between Supabase and backend
- Verify `.env` has correct `SUPABASE_JWT_SECRET`

### "No authentication token available"
- User session expired
- Redirect to `/login` to re-authenticate

### Interview data missing after migration
- Old interviews don't have `user_id`
- Either manually assign to a user or mark as archived

## Production Deployment

### Supabase
1. Run updated schema in production database
2. Enable Row Level Security (RLS) policies:
```sql
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interviews"
ON interviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interviews"
ON interviews FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Backend
1. Set all environment variables
2. Ensure `SUPABASE_JWT_SECRET` is set
3. Deploy with authentication middleware active

### Frontend
1. Update environment variables for production URLs
2. Deploy with AuthProvider wrapper in root layout
3. Verify login/signup pages are accessible

## Support
For issues or questions, check:
- Supabase Dashboard → Logs for authentication errors
- Backend logs for JWT verification failures  
- Browser console for frontend authentication state
