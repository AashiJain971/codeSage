-- Migration: Add language column to question_responses table
-- This stores the programming language used for each question in technical interviews

-- Add language column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'question_responses' 
        AND column_name = 'language'
    ) THEN
        ALTER TABLE question_responses 
        ADD COLUMN language VARCHAR(50) DEFAULT 'python';
        
        COMMENT ON COLUMN question_responses.language IS 'Programming language used for this question (python, javascript, java, etc.)';
    END IF;
END $$;

-- Update existing records to have python as default if NULL
UPDATE question_responses 
SET language = 'python' 
WHERE language IS NULL;

-- Create index on language for faster filtering
CREATE INDEX IF NOT EXISTS idx_question_responses_language ON question_responses(language);

SELECT 'Migration completed: language column added to question_responses table' AS status;
