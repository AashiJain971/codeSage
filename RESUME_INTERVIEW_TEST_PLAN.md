# Resume Interview Dynamic Scoring - Test Plan

## Quick Test Steps

### 1. Start Resume Interview
```bash
# Terminal 1: Start backend
cd /Users/adityajain/codeSageNew/backend
uvicorn ws_server:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Start frontend
cd /Users/adityajain/codeSageNew/frontend
npm run dev
```

### 2. Run Interview
1. Navigate to http://localhost:3000
2. Login with Supabase credentials
3. Upload a resume
4. Start resume-based interview
5. Answer 3-5 questions
6. Click "End Interview"

### 3. Verify Database Entries

#### Check `question_responses` table:
```sql
SELECT 
    question_index,
    score,
    time_taken,
    difficulty,
    LEFT(user_response, 50) as response_preview
FROM question_responses
WHERE session_id = '<your_session_id>'
ORDER BY question_index;
```

**Expected:**
- All questions have `score` between 0-100 (not NULL)
- `time_taken` is > 0 for each question
- `difficulty` = 'conversational'
- All responses stored

#### Check `interviews` table:
```sql
SELECT 
    session_id,
    interview_type,
    completed_questions,
    average_score,
    individual_scores,
    duration
FROM interviews
WHERE interview_type = 'resume'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `average_score` > 0 (not hardcoded 0)
- `individual_scores` array has length = `completed_questions`
- All scores in `individual_scores` are between 0-100
- `duration` > 0

### 4. Check Backend Logs

Look for these log messages:
```
✅ Resume interview session created: <session_id>
✅ Stored resume Q&A #1 (score: 75)
✅ Stored resume Q&A #2 (score: 82)
...
📊 Resume interview metrics:
   Questions: 5
   Scores: [75, 82, 68, 90, 77]
   Average: 78
✅ Resume interview saved to database: <session_id>
```

### 5. Verify Frontend Display

**Past Interviews Page:**
- Resume interview appears in list
- Shows correct average score (not 0)
- Shows correct number of questions
- Duration displayed correctly

**Interview Detail View:**
- Each question shows score
- Timeline shows time per question
- Overall score chart displays correctly

## Expected LLM Evaluation Format

The LLM should now include ratings in responses:

```json
{
  "evaluation": "Great explanation of the project architecture. You clearly articulated the tech stack and design decisions. Rating: 8/10",
  "next_question": "Can you tell me about the biggest challenge you faced in this project?"
}
```

## Edge Cases to Test

### Test Case 1: Poor Answer
- Give a vague or incorrect response
- **Expected:** Score 0-30, LLM asks for clarification

### Test Case 2: Excellent Answer
- Give detailed, technical response matching resume
- **Expected:** Score 80-100, LLM acknowledges quality

### Test Case 3: One-Word Answer
- Say "yes" or "no"
- **Expected:** Still gets stored, score 20-40, LLM asks for elaboration

### Test Case 4: LLM Doesn't Include Rating
- If rating parse fails (rare)
- **Expected:** Default score of 50, interview continues normally

### Test Case 5: Multiple Questions
- Answer 10+ questions
- **Expected:** All stored with unique scores, average calculates correctly

## Debugging Checklist

If scores are still 0:
- [ ] Check backend logs for "extract_score_from_evaluation()" debug output
- [ ] Verify LLM responses include "Rating: X/10" format
- [ ] Check `individual_scores` array in session before completion
- [ ] Verify `last_question_time` is being updated after each Q&A
- [ ] Check for database connection errors in logs

If time_taken is 0:
- [ ] Verify `last_question_time` initialized at interview start
- [ ] Check time calculation in Q&A handler
- [ ] Look for timezone or timestamp issues

If validation fails (score count mismatch):
- [ ] Check if `db.store_question_response()` is being called
- [ ] Verify no exceptions in database storage
- [ ] Check `individual_scores.append(score)` executes

## Success Criteria

✅ All resume interviews have non-zero `average_score`
✅ `individual_scores` array is populated (not empty)
✅ Each question has entry in `question_responses` table
✅ Scores reflect answer quality (vary based on responses)
✅ Time tracking works for each question
✅ Past Interviews shows accurate data
✅ No hardcoded 0 or empty arrays in completion logic

## Quick SQL Query for Mass Verification

```sql
-- Check all recent resume interviews
SELECT 
    i.session_id,
    i.completed_questions,
    i.average_score,
    array_length(i.individual_scores, 1) as scores_count,
    COUNT(qr.id) as stored_questions
FROM interviews i
LEFT JOIN question_responses qr ON i.session_id = qr.session_id
WHERE i.interview_type = 'resume'
    AND i.created_at > NOW() - INTERVAL '1 day'
GROUP BY i.session_id, i.completed_questions, i.average_score, i.individual_scores
ORDER BY i.created_at DESC;
```

**Expected:** All rows have:
- `average_score` > 0
- `scores_count` = `completed_questions`
- `stored_questions` = `completed_questions`

---
**Status:** Ready for Testing
**Implementation:** Complete in [ws_server.py](backend/ws_server.py)
**Documentation:** [RESUME_INTERVIEW_FIX_SUMMARY.md](RESUME_INTERVIEW_FIX_SUMMARY.md)
