# 🚀 Create Supabase Database Tables - Step by Step Guide

## 📋 Instructions to Make Tables Visible in Supabase GUI

### Step 1: Access Supabase Dashboard
1. Go to: **https://sljkpfchguoyarajxhvc.supabase.co**
2. Login to your Supabase account
3. Navigate to **SQL Editor** (in the left sidebar)

### Step 2: Create Tables Using SQL Editor
1. Click **"+ New Query"** in the SQL Editor
2. Copy and paste the **ENTIRE** content from `supabase_create_tables.sql`
3. Click **"Run"** (or press Ctrl/Cmd + Enter)

### Step 3: Verify Tables are Created
After running the SQL:
1. Go to **"Table Editor"** in the left sidebar
2. You should now see:
   - `interviews` table
   - `question_responses` table

### Step 4: View Your Tables
In the Table Editor, you can:
- **Browse data** in each table
- **View table structure** (columns, types, constraints)
- **Add/edit records** manually if needed
- **Export data** as CSV or JSON

### Step 5: Test Database Connection
Run this command in your backend terminal:
```bash
cd /Users/adityajain/CodeSage/backend
./venv_local/bin/python verify_database.py
```

## 🔍 What You Should See in Supabase GUI

### `interviews` table columns:
- `id` (bigint, primary key)
- `interview_id` (uuid, auto-generated)
- `session_id` (text, unique)
- `interview_type` (text, default: 'technical')
- `topics` (text array)
- `start_time`, `end_time` (timestamptz)
- `duration` (integer, seconds)
- `status` (text: 'in_progress', 'completed', 'abandoned')
- `total_questions`, `completed_questions` (integer)
- `average_score` (decimal)
- `individual_scores` (integer array)
- `final_results` (jsonb)
- `created_at`, `updated_at` (timestamptz)

### `question_responses` table columns:
- `id` (bigint, primary key)
- `session_id` (text, foreign key)
- `question_index` (integer)
- `question_text` (text)
- `expected_solution` (text)
- `user_response` (text)
- `score` (integer, 0-100)
- `feedback` (text)
- `time_taken` (integer, seconds)
- `hints_used` (integer)
- `difficulty` (text: 'easy', 'medium', 'hard')
- `created_at` (timestamptz)

## 🎯 After Creating Tables

1. **Test an Interview**: Start a technical interview and complete it
2. **Check Database**: Go to Table Editor and see your data populate automatically
3. **View Results**: Your results page will now show real data from the database
4. **Analytics**: You can query the database for interview analytics and insights

## 🛠️ Troubleshooting

If tables don't appear:
1. **Refresh** the Supabase dashboard
2. Check for **error messages** in the SQL Editor
3. Ensure you **copied the entire SQL** from `supabase_create_tables.sql`
4. Try running each CREATE TABLE statement **individually**

## 📊 Sample Data

The SQL script includes sample data insertion, so you should see at least one test record in the interviews table after running the script.

---

**🎉 Once completed, your interview system will have professional database storage with all data visible and manageable through the Supabase GUI!**