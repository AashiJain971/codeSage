# Interview Data Flow Audit & Fixes

## Executive Summary

**Status**: ⚠️ **PARTIAL COMPLIANCE** - Resume interviews have hardcoded scores and missing time tracking. Technical interviews are mostly compliant.

**Critical Issues Found**:
1. ❌ Resume interviews: `average_score` hardcoded to `0`
2. ❌ Resume interviews: No per-question scoring or evaluation
3. ❌ Resume interviews: Missing `time_taken` per question
4. ❌ Resume interviews: Missing `code_submission` field population
5. ⚠️ Technical interviews: `question_start_time` not reset properly in all paths
6. ⚠️ Both: `individual_scores` array not validated for completeness

---

## Field-by-Field Analysis

### ✅ COMPLIANT FIELDS (Correctly Computed & Stored)

| Field | Source | Computation | Storage Location | Verified |
|-------|--------|-------------|------------------|----------|
| `session_id` | UUID generated at interview start | `str(uuid.uuid4())` | `interviews.session_id` | ✅ |
| `user_id` | JWT token from authenticated user | From `token_payload["sub"]` | `interviews.user_id` | ✅ |
| `interview_type` | User selection (technical/resume) | From WebSocket init message | `interviews.interview_type` | ✅ |
| `status` | Interview state | `"in_progress"` → `"completed"` | `interviews.status` | ✅ |
| `topics` | Extracted from resume or user input | Resume: LLM extraction<br>Technical: User selected | `interviews.topics` | ✅ |
| `total_questions` | Count of questions asked | `len(session.questions)` (technical)<br>`len(conversation)` (resume) | `interviews.total_questions` | ✅ |
| `start_time` | Timestamp when interview begins | `time.time()` → ISO format | `interviews.start_time` | ✅ |
| `end_time` | Timestamp when interview ends | `time.time()` → ISO format | `interviews.end_time` | ✅ |
| `duration` | Total interview time in seconds | `end_time - start_time` | `interviews.duration` | ✅ |
| `final_results` | Complete interview data | JSON blob with all conversation data | `interviews.final_results` | ✅ |
| `created_at` | Database record creation time | `datetime.utcnow().isoformat()` | `interviews.created_at` | ✅ |
| `updated_at` | Database record update time | `datetime.utcnow().isoformat()` | `interviews.updated_at` | ✅ |

### ✅ TECHNICAL INTERVIEW - COMPLIANT

| Field | Source | Computation | Storage | Verified |
|-------|--------|-------------|---------|----------|
| `score` (per question) | LLM evaluation of code submission | Groq API evaluates code quality, correctness, efficiency | `question_responses.score` | ✅ |
| `average_score` | Mean of all question scores | `sum(scores) / len(scores)` | `interviews.average_score` | ✅ |
| `individual_scores` | Array of all scores | `[score1, score2, ...]` from `session.scores` | `interviews.individual_scores` | ✅ |
| `time_taken` (per question) | Time from question shown to answer submitted | `int(time.time() - session.question_start_time)` | `question_responses.time_taken` | ✅ |
| `completed_questions` | Count of answered questions | `len([s for s in self.scores if s is not None])` | `interviews.completed_questions` | ✅ |
| `current_question_index` | Active question position | Incremented via `session.next_question()` | `interviews.current_question_index` | ✅ |
| `hints_used` | Number of hints requested | Incremented when user requests hint | `question_responses.hints_used` | ✅ |
| `difficulty` | Question difficulty level | From question metadata | `question_responses.difficulty` | ✅ |
| `code_submission` | User's submitted code | From frontend code editor | `question_responses.code_submission` | ✅ |
| `user_response` | User's text answer/explanation | From frontend textarea or transcription | `question_responses.user_response` | ✅ |
| `feedback` | LLM feedback on answer | Groq API evaluation response | `question_responses.feedback` | ✅ |
| `question_text` | The actual question asked | From `session.questions[index]` | `question_responses.question_text` | ✅ |

### ❌ RESUME INTERVIEW - NON-COMPLIANT FIELDS

| Field | Current Value | Issue | Fix Required |
|-------|---------------|-------|--------------|
| `average_score` | **Hardcoded: `0`** | No scoring implemented | ✅ Implement conversation quality evaluation |
| `individual_scores` | **Empty array: `[]`** | No per-question scores | ✅ Score each Q&A exchange |
| `score` (per question) | **Not stored** | Resume interviews don't call `store_question_response` | ✅ Store each exchange |
| `time_taken` (per question) | **Not tracked** | No timestamps per question | ✅ Add timing tracking |
| `code_submission` | **Always NULL** | Resume interviews are conversational | ✅ Expected NULL - compliant |
| `feedback` | **Not stored** | LLM provides feedback but not persisted | ✅ Store feedback per question |
| `user_response` | **Not stored individually** | Only in `final_results` JSON | ✅ Store in `question_responses` |
| `question_text` | **Not stored individually** | Only in conversation log | ✅ Store in `question_responses` |

### ⚠️ PARTIALLY COMPLIANT

| Field | Issue | Location | Fix |
|-------|-------|----------|-----|
| `completion_method` | Multiple fallback layers cause confusion | `ws_server.py:413-426`<br>`database.py:253` | ✅ Simplify to single source |
| `current_question_index` | 0-based vs 1-based conversion inconsistent | Multiple locations | ✅ Document conversion points |

---

## Detailed Fix Implementation

### Fix 1: Resume Interview Scoring System

**Problem**: Resume interviews currently hardcode `average_score = 0` and `individual_scores = []`

**Location**: `backend/ws_server.py` line 1467

**Current Code**:
```python
results_data = {
    "end_time": end_time,
    "duration": duration,
    "total_time": duration,
    "completed_questions": len(session["conversation"]),
    "average_score": 0,  # ❌ HARDCODED
    "individual_scores": [],  # ❌ EMPTY
    "final_results": interview_data,
    "completion_method": "manual"
}
```

**Fix**: Implement evaluation for each Q&A exchange

**New Implementation**:
```python
# Calculate scores for each Q&A pair
individual_scores = []
for qa in session["conversation"]:
    # Extract evaluation score from LLM response
    # The 'evaluation' field should contain a numerical score
    eval_text = qa.get("evaluation", "")
    score = extract_score_from_evaluation(eval_text)
    individual_scores.append(score)

average_score = round(sum(individual_scores) / len(individual_scores)) if individual_scores else 0

results_data = {
    "end_time": end_time,
    "duration": duration,
    "total_time": duration,
    "completed_questions": len(session["conversation"]),
    "average_score": average_score,  # ✅ COMPUTED
    "individual_scores": individual_scores,  # ✅ COMPUTED
    "final_results": interview_data,
    "completion_method": session.get("completion_method", "manually_ended")
}
```

**Helper Function Needed**:
```python
def extract_score_from_evaluation(evaluation_text: str) -> int:
    """
    Extract numerical score from LLM evaluation text.
    Expected format: "Rating: 7/10" or "Score: 85/100"
    Returns: integer score (0-100 scale)
    """
    import re
    # Try to find "X/10" or "X/100" patterns
    match = re.search(r'(\d+)\s*/\s*(\d+)', evaluation_text)
    if match:
        score, max_score = int(match.group(1)), int(match.group(2))
        # Normalize to 100-point scale
        return int((score / max_score) * 100)
    
    # Fallback: look for standalone numbers
    match = re.search(r'\b(\d{1,3})\b', evaluation_text)
    if match:
        score = int(match.group(1))
        if score <= 100:
            return score
        elif score <= 10:
            return score * 10
    
    # Default to 50 if no score found
    return 50
```

---

### Fix 2: Store Resume Interview Question Responses

**Problem**: Resume interviews don't store individual Q&A pairs in `question_responses` table

**Location**: `backend/ws_server.py` around line 1420 (after getting AI response)

**Current Code**:
```python
reply = interviewer_reply(candidate, session["conversation"])
session["conversation"].append({
    "candidate": candidate,
    **reply
})

await ws.send_text(json.dumps({"type": "assessment", **reply}))
# ❌ No database storage here
```

**Fix**: Add database storage after each Q&A exchange

**New Code**:
```python
# Get AI response
reply = interviewer_reply(candidate, session["conversation"])

# Extract score from evaluation
score = extract_score_from_evaluation(reply.get("evaluation", ""))

# Append to conversation
session["conversation"].append({
    "candidate": candidate,
    "score": score,  # Add score to conversation log
    **reply
})

# ✅ Store in question_responses table
question_index = len(session["conversation"])
question_text = reply.get("next_question", "Follow-up question")

question_data = {
    "question": question_text,
    "user_response": candidate,
    "score": score,
    "feedback": reply.get("evaluation", ""),
    "time_taken": int(time.time() - session.get("last_question_time", time.time())),
    "hints_used": 0,  # Resume interviews don't use hints
    "difficulty": "conversational"  # Or extract from evaluation
}

await db.store_question_response(
    session["session_id"],
    question_index,
    question_data
)

# Track time for next question
session["last_question_time"] = time.time()

await ws.send_text(json.dumps({"type": "assessment", **reply}))
```

---

### Fix 3: Add Time Tracking to Resume Interviews

**Problem**: Resume interviews don't track `time_taken` per question

**Location**: Initialize when question is asked, calculate when answer received

**Implementation**:

**Step 1**: Initialize timestamp when sending question
```python
# In resume interview init (line ~1230)
session["last_question_time"] = time.time()
```

**Step 2**: Calculate elapsed time when receiving answer
```python
# In answer handler (line ~1370)
time_taken = int(time.time() - session.get("last_question_time", time.time()))

question_data = {
    # ... other fields
    "time_taken": time_taken,  # ✅ Dynamic calculation
}

# Reset for next question
session["last_question_time"] = time.time()
```

---

### Fix 4: Update LLM Prompt to Include Scoring

**Problem**: Resume interview prompt doesn't explicitly request scoring

**Location**: `backend/interview_with_resume.py` INTERVIEWER_PROMPT

**Current**: No scoring guidance

**Fix**: Add scoring requirement to prompt

```python
INTERVIEWER_PROMPT = """
You are a technical interviewer conducting a resume-based interview.

For each response, you must provide:
1. **Evaluation** (mandatory): Rate the candidate's answer on a scale of 1-10 considering:
   - Technical accuracy and depth
   - Communication clarity
   - Relevance to the question
   - Examples and specifics provided
   Format: "Rating: X/10 - [brief reasoning]"

2. **Hint** (if needed): Guidance if answer was incomplete

3. **Next Question**: Follow-up or new question based on resume

Example evaluation format:
"Rating: 7/10 - Good explanation of the architecture, but could provide more detail on scalability considerations."
"""
```

---

## Scoring & Metrics Logic (Explicit Documentation)

### Technical Interviews

**Per-Question Score** (`question_responses.score`):
- **Source**: LLM evaluation via Groq API
- **Input**: User's code submission + question context
- **Process**: 
  1. Code sent to `llm_evaluate_code_submission()` function
  2. LLM evaluates: correctness, efficiency, code quality, edge cases
  3. Returns score 0-100
- **Storage**: Immediately stored in `question_responses.score`
- **Location**: `ws_server.py:1680-1695`

**Average Score** (`interviews.average_score`):
- **Formula**: `sum(all_scores) / count(all_scores)`
- **Source**: `session.get_final_score()` → `sum(self.scores) / len(self.scores)`
- **Timing**: Calculated at interview completion
- **Storage**: Written to `interviews.average_score` as integer
- **Location**: `ws_server.py:489-490, 423`

**Individual Scores** (`interviews.individual_scores`):
- **Source**: `session.scores` array
- **Format**: Integer array `[85, 92, 78, ...]`
- **Normalization**: Floats converted to ints before storage
- **Storage**: Written as PostgreSQL integer array
- **Location**: `ws_server.py:410, 424`

**Time Taken** (`question_responses.time_taken`):
- **Formula**: `current_time - question_start_time`
- **Units**: Seconds (integer)
- **Source**: `session.question_start_time` set when question shown
- **Reset**: On `session.next_question()` call
- **Storage**: Stored per question in `question_responses.time_taken`
- **Location**: `ws_server.py:387, 477`

**Duration** (`interviews.duration`):
- **Formula**: `end_time - start_time`
- **Units**: Seconds (integer)
- **Source**: `session.start_time` (set at interview init), `session.end_time` (set at completion)
- **Storage**: Written to `interviews.duration`
- **Location**: `ws_server.py:419, database.py:245`

**Completed Questions** (`interviews.completed_questions`):
- **Formula**: Count of non-null scores in `session.scores`
- **Source**: `len([s for s in self.scores if s is not None])`
- **Updates**: Real-time via `update_progress_in_db()`
- **Final**: Confirmed at interview completion
- **Location**: `ws_server.py:366, 422`

**Completion Method** (`interviews.completion_method`):
- **Values**: `"automatic"`, `"manually_ended"`, `"timeout_cleanup"`
- **Source**: 
  - `"manually_ended"`: User clicks "End Interview" button
  - `"automatic"`: All questions completed naturally
  - `"timeout_cleanup"`: Session timeout (not yet implemented)
- **Storage**: Normalized from `completion_status` or `completion_method` key
- **Location**: `ws_server.py:413-426, database.py:253`

---

### Resume Interviews (After Fixes)

**Per-Question Score** (`question_responses.score`):
- **Source**: LLM evaluation text → extracted via regex
- **Input**: `evaluation` field from `interviewer_reply()`
- **Process**:
  1. LLM provides rating (e.g., "Rating: 7/10")
  2. `extract_score_from_evaluation()` parses numerical score
  3. Normalized to 0-100 scale
- **Storage**: Stored per question via `store_question_response()`
- **Location**: NEW - to be added

**Average Score** (`interviews.average_score`):
- **Formula**: `sum(all_question_scores) / count(questions)`
- **Source**: Calculated from `individual_scores` array
- **Timing**: At interview completion
- **Storage**: Written to `interviews.average_score` as integer
- **Location**: NEW - replacing hardcoded `0`

**Time Taken** (`question_responses.time_taken`):
- **Formula**: `answer_time - question_time`
- **Source**: `session["last_question_time"]` updated per Q&A cycle
- **Storage**: Stored per question
- **Location**: NEW - to be added

---

## Implementation Checklist

### High Priority (Blocking Issues)

- [ ] **Fix 1**: Implement `extract_score_from_evaluation()` helper function
- [ ] **Fix 2**: Update resume interview LLM prompt to include explicit scoring
- [ ] **Fix 3**: Add score extraction and storage after each resume Q&A
- [ ] **Fix 4**: Initialize and track `last_question_time` for resume interviews
- [ ] **Fix 5**: Call `store_question_response()` after each resume answer
- [ ] **Fix 6**: Calculate `individual_scores` and `average_score` for resume interviews

### Medium Priority (Data Quality)

- [ ] **Fix 7**: Validate `individual_scores` array length matches `total_questions`
- [ ] **Fix 8**: Add null checks before scoring calculations
- [ ] **Fix 9**: Ensure `question_start_time` reset in all code paths
- [ ] **Fix 10**: Standardize `completion_method` field naming (remove dual keys)

### Low Priority (Enhancements)

- [ ] Add confidence intervals for scores
- [ ] Track answer revision count
- [ ] Store partial answers (autosave)
- [ ] Add video/audio recording metadata

---

## Testing Plan

### Unit Tests Needed

1. **Scoring Extraction**: Test `extract_score_from_evaluation()` with various formats
2. **Time Calculations**: Verify `time_taken` and `duration` accuracy
3. **Score Normalization**: Test float→int conversion and array handling
4. **Edge Cases**: Empty scores, single question, interrupted interviews

### Integration Tests

1. **End-to-End Resume Interview**: Verify all fields stored correctly
2. **End-to-End Technical Interview**: Confirm existing behavior maintained
3. **Database Queries**: Test `interview_summary` view with new data
4. **Past Interviews Page**: Verify scores display correctly

### Manual Testing Checklist

- [ ] Start resume interview → check `interviews` record created
- [ ] Answer 3 questions → verify `question_responses` rows created
- [ ] End interview → confirm `average_score` is non-zero
- [ ] Check database directly → validate `individual_scores` array
- [ ] View Past Interviews page → scores display correctly

---

## Migration Notes

**Database Schema**: ✅ No changes needed - all fields already exist

**Backwards Compatibility**:
- Existing resume interviews have `average_score = 0`
- Can run data migration to recalculate scores from `final_results` JSON
- Or leave old data as-is (scores only for new interviews)

**Deployment**:
1. Deploy code changes
2. Test with new interview
3. (Optional) Run migration script for historical data

---

## Summary Statistics

**Total Fields Audited**: 32
**✅ Compliant**: 24 (75%)
**❌ Non-Compliant**: 6 (19%)
**⚠️ Partially Compliant**: 2 (6%)

**Fixes Required**: 10
**Estimated Effort**: 4-6 hours
**Risk Level**: Low (additive changes, no schema modifications)

---

## Next Steps

1. Implement `extract_score_from_evaluation()` function
2. Update `INTERVIEWER_PROMPT` to include scoring requirement
3. Add scoring logic to resume interview answer handler
4. Add time tracking to resume interview flow
5. Test end-to-end with sample resume interview
6. Validate database storage
7. Deploy and monitor

**Owner**: Backend Developer
**Timeline**: Can be completed in 1 sprint
**Dependencies**: None (all changes backend-only)
