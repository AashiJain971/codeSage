-- ===============================================================================
-- CODESAGE INTERVIEW SYSTEM - COMPLETE DATABASE SCHEMA
-- ===============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy this ENTIRE script
-- 2. Go to Supabase Dashboard > SQL Editor  
-- 3. Paste and click "Run"
-- 4. Done! All tables created and ready to use.
--
-- This script:
-- • Creates 2 tables: interviews, question_responses
-- • No duplicate or redundant tables
-- • Includes all required columns for manual interview ending
-- • Safe to run multiple times
-- ===============================================================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS question_responses CASCADE;
DROP TABLE IF EXISTS interview_results CASCADE;  -- Remove duplicate table
DROP TABLE IF EXISTS interviews CASCADE;
DROP VIEW IF EXISTS interview_results_view CASCADE;

-- ===============================================================================
-- TABLE 1: INTERVIEWS - Main interview sessions
-- ===============================================================================
CREATE TABLE interviews (
    -- Primary identifiers
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Interview metadata
    interview_type TEXT NOT NULL DEFAULT 'technical',
    status TEXT NOT NULL DEFAULT 'in_progress',
    topics TEXT[] DEFAULT '{}',
    
    -- Question tracking
    total_questions INTEGER DEFAULT 0,
    completed_questions INTEGER DEFAULT 0,
    current_question_index INTEGER DEFAULT 0,
    
    -- Scoring
    average_score INTEGER DEFAULT NULL,
    individual_scores INTEGER[] DEFAULT '{}',
    
    -- Timing
    duration INTEGER DEFAULT 0,
    start_time TIMESTAMPTZ DEFAULT NULL,
    end_time TIMESTAMPTZ DEFAULT NULL,
    
    -- Results and completion tracking
    final_results JSONB DEFAULT '{}',
    completion_method TEXT DEFAULT 'automatic',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================================================
-- TABLE 2: QUESTION_RESPONSES - Individual question answers
-- ===============================================================================
CREATE TABLE question_responses (
    -- Primary identifiers
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    question_index INTEGER NOT NULL,
    
    -- Question content
    question_text TEXT NOT NULL,
    
    -- User responses
    user_response TEXT DEFAULT NULL,
    code_submission TEXT DEFAULT NULL,
    
    -- Evaluation
    score INTEGER DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    time_taken INTEGER DEFAULT NULL,
    hints_used INTEGER DEFAULT 0,
    difficulty TEXT DEFAULT 'medium',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_question_responses_session 
        FOREIGN KEY (session_id) 
        REFERENCES interviews(session_id) 
        ON DELETE CASCADE
);

-- ===============================================================================
-- INDEXES FOR PERFORMANCE
-- ===============================================================================
CREATE INDEX idx_interviews_session_id ON interviews(session_id);
CREATE INDEX idx_interviews_user_id ON interviews(user_id);
CREATE INDEX idx_interviews_status ON interviews(status);
CREATE INDEX idx_interviews_completion_method ON interviews(completion_method);
CREATE INDEX idx_interviews_created_at ON interviews(created_at DESC);

CREATE INDEX idx_question_responses_session_id ON question_responses(session_id);
CREATE INDEX idx_question_responses_question_index ON question_responses(session_id, question_index);
CREATE INDEX idx_question_responses_created_at ON question_responses(created_at DESC);

-- ===============================================================================
-- HELPFUL VIEW FOR RESULTS (replaces interview_results table)
-- ===============================================================================
CREATE OR REPLACE VIEW interview_summary AS
SELECT 
    i.session_id,
    i.interview_type,
    i.status,
    i.completion_method,
    i.topics,
    i.total_questions,
    i.completed_questions,
    i.current_question_index,
    i.average_score,
    i.individual_scores,
    i.duration,
    i.start_time,
    i.end_time,
    i.final_results,
    i.created_at,
    i.updated_at,
    
    -- Calculated fields
    CASE 
        WHEN i.completion_method = 'manually_ended' THEN '🔴 Manually Ended'
        WHEN i.completion_method = 'timeout_cleanup' THEN '⏰ Timeout'
        ELSE '✅ Completed'
    END as status_display,
    
    CASE 
        WHEN i.duration > 0 THEN CONCAT(FLOOR(i.duration/60), 'm ', i.duration%60, 's')
        ELSE 'N/A'
    END as duration_display,
    
    -- Count of actual question responses
    COALESCE(qr.response_count, 0) as actual_responses
    
FROM interviews i
LEFT JOIN (
    SELECT 
        session_id, 
        COUNT(*) as response_count
    FROM question_responses 
    GROUP BY session_id
) qr ON i.session_id = qr.session_id;

-- ===============================================================================
-- SAMPLE DATA FOR TESTING (uncomment to insert test data)
-- ===============================================================================
/*
INSERT INTO interviews (
    session_id, interview_type, status, topics, total_questions, 
    completed_questions, average_score, duration, completion_method
) VALUES 
('test-session-001', 'technical', 'completed', ARRAY['Arrays', 'Strings'], 
 2, 2, 85, 600, 'automatic'),
('test-session-002', 'technical', 'completed', ARRAY['Trees', 'Graphs'], 
 3, 2, 75, 450, 'manually_ended');

INSERT INTO question_responses (
    session_id, question_index, question_text, user_response, 
    code_submission, score, feedback, time_taken, hints_used
) VALUES 
('test-session-001', 1, 'Find duplicates in array', 'Use hash set approach', 
 'def find_duplicates(arr): return list(set([x for x in arr if arr.count(x) > 1]))', 
 85, 'Good solution, could optimize further', 300, 1),
('test-session-001', 2, 'Reverse a string', 'Simple slicing approach', 
 'def reverse_string(s): return s[::-1]', 
 90, 'Perfect solution!', 120, 0);
*/

-- ===============================================================================
-- VERIFICATION QUERIES
-- ===============================================================================

-- Show all tables created
SELECT 
    table_name,
    'BASE TABLE' as table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('interviews', 'question_responses')
ORDER BY table_name;

-- Show interviews table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'interviews'
ORDER BY ordinal_position;

-- Show question_responses table structure  
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'question_responses'
ORDER BY ordinal_position;

-- Show created indexes
SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('interviews', 'question_responses')
ORDER BY tablename, indexname;

-- Show the view
SELECT 
    table_name,
    'VIEW' as table_type
FROM information_schema.views 
WHERE table_name = 'interview_summary';

-- Final success message
SELECT 
    '🎉 SUCCESS! Database schema created successfully!' as message,
    'interviews' as main_table,
    'question_responses' as responses_table,
    'interview_summary' as results_view;