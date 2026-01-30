#!/bin/bash

echo "🔧 Running migration: Add email to user_profiles"
echo ""
echo "📋 Please follow these steps:"
echo "1. Go to your Supabase Dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Copy and paste the following SQL:"
echo ""
echo "================================"
cat migrations/add_email_to_user_profiles.sql
echo "================================"
echo ""
echo "4. Click 'Run' to execute the migration"
echo ""
echo "✅ After running, the email column will be added to user_profiles table"
