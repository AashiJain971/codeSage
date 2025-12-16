# Supabase Database Setup Instructions

## Step 1: Login to Supabase Dashboard
1. Go to https://sljkpfchguoyarajxhvc.supabase.co
2. Login with your Supabase account

## Step 2: Create Tables
Go to the SQL Editor in your Supabase dashboard and run the following SQL commands:

### Create interviews table:
```sql
CREATE TABLE IF NOT EXISTS interviews (
    id BIGSERIAL PRIMARY KEY,
    interview_id UUID NOT NULL UNIQUE,
    session_id TEXT NOT NULL UNIQUE,
    interview_type TEXT NOT NULL DEFAULT 'technical',
    topics TEXT[] DEFAULT '{}',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'in_progress',
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    current_question_index INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    individual_scores INTEGER[],
    final_results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Create question_responses table:
```sql
CREATE TABLE IF NOT EXISTS question_responses (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES interviews(session_id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    expected_solution TEXT,
    user_response TEXT,
    score INTEGER,
    feedback TEXT,
    time_taken INTEGER,
    hints_used INTEGER DEFAULT 0,
    difficulty TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, question_index)
);
```

### Create indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_interviews_session_id ON interviews(session_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_responses_session_id ON question_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_question_responses_question_index ON question_responses(question_index);
```

## Step 3: Verify Setup
After running the SQL commands, you can test the connection by running:
```bash
cd /Users/adityajain/CodeSage/backend
./venv_local/bin/python -c "from database import db; import asyncio; print('Database connected successfully!' if db.supabase else 'Database connection failed')"
```

## Database Schema Overview

### interviews table
- Stores main interview session information
- Tracks progress, scores, and completion status
- Includes complete results as JSONB for flexibility

### question_responses table
- Stores individual question data and responses
- Links to interviews table via session_id
- Tracks detailed metrics per question

## What Data Gets Stored

1. **Session Information**: Start time, end time, duration
2. **Interview Configuration**: Topics, question count, difficulty
3. **Progress Tracking**: Current question, completed questions
4. **Performance Data**: Individual scores, average score
5. **Question Details**: Each question text, user response, feedback
6. **Complete Results**: Full interview results as JSON

The system will automatically:
- Create database records when interviews start
- Update progress as questions are completed  
- Store individual question responses and scores
- Mark interviews as completed with final results
- Provide API endpoints to retrieve stored data