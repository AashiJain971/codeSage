# SWOT Analysis Caching - Migration Guide

## Problem Solved
- ❌ SWOT analysis was regenerating on **every API request**
- ❌ Wasting tokens and hitting Groq rate limits
- ✅ Now cached in Supabase and reused intelligently

## How to Run Migration

### Step 1: Create the Table
1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Copy and paste the contents of `migrations/add_swot_analysis_cache.sql`
4. Click **Run**

### Step 2: Fix RLS (IMPORTANT!)
If you see error: `new row violates row-level security policy`

1. In Supabase SQL Editor
2. Copy and paste the contents of `migrations/fix_rls_user_profiles.sql`
3. Click **Run**
4. This disables RLS to allow backend caching

**That's it!** ✅

## What This Does

Creates a `user_profiles` table with:
- `swot_analysis` (JSONB) - Cached SWOT data
- `last_interview_count` - Tracks interview count changes
- `last_interview_date` - Tracks new interviews
- `swot_generated_at` - Cache timestamp

## Cache Invalidation Rules

SWOT will regenerate **only when**:
- ✅ A new interview is added
- ✅ Interview count changes
- ✅ Latest interview date changes

Otherwise, cached SWOT is reused! 🎉

## After Migration

Restart your backend server:
```bash
# Kill existing server
pkill -f "uvicorn"

# Start with api.py
cd backend
uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

## Verify It's Working

Check backend logs for:
- `✅ Using cached SWOT analysis` - Cache hit
- `🎯 Generating NEW SWOT analysis` - Cache miss/regeneration
- `🔄 Interview count changed` - Cache invalidation
