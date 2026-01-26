# Technical Interview Scoring - Test Scenarios

## Quick Validation Tests

### Test 1: Perfect Score (100)
**Setup:**
- Write fully correct solution
- Don't use any hints
- Don't ask for clarifications
- Submit code immediately

**Expected:**
```
🎯 Technical Correctness: fully_correct → Base Score: 100
📊 Score Calculation:
   Base (fully_correct): 100
   Total Deductions: -0
   Final Score: 100/100
```

### Test 2: Correct with 1 Hint (90)
**Setup:**
- Use 1 hint
- Write fully correct solution
- No discussion

**Expected:**
```
🎯 Technical Correctness: fully_correct → Base Score: 100
  ⚠️ Hints penalty: -10 (1 hints × 10)
📊 Score Calculation:
   Base (fully_correct): 100
   Total Deductions: -10
   Final Score: 90/100
```

### Test 3: Correct with 2 Hints (80)
**Setup:**
- Use 2 hints
- Write fully correct solution
- No discussion

**Expected:**
```
🎯 Technical Correctness: fully_correct → Base Score: 100
  ⚠️ Hints penalty: -20 (2 hints × 10)
📊 Score Calculation:
   Base (fully_correct): 100
   Total Deductions: -20
   Final Score: 80/100
```

### Test 4: Mostly Correct, No Help (80)
**Setup:**
- Write code with minor syntax error or missed edge case
- No hints
- No discussion

**Expected:**
```
🎯 Technical Correctness: mostly_correct → Base Score: 80
📊 Score Calculation:
   Base (mostly_correct): 80
   Total Deductions: -0
   Final Score: 80/100
```

### Test 5: Mostly Correct + Debugging (55)
**Setup:**
- Write mostly correct code
- Use 1 hint
- Have 3 discussion turns (ask questions, clarify logic)

**Expected:**
```
🎯 Technical Correctness: mostly_correct → Base Score: 80
  ⚠️ Hints penalty: -10 (1 hints × 10)
  ⚠️ Discussion penalty: -15 (3 turns × 5)
📊 Score Calculation:
   Base (mostly_correct): 80
   Total Deductions: -25
   Final Score: 55/100
```

### Test 6: Mostly Correct + Many Clarifications (45)
**Setup:**
- Write mostly correct code
- Use 1 hint
- Ask 5 clarification questions (>2 threshold)

**Expected:**
```
🎯 Technical Correctness: mostly_correct → Base Score: 80
  ⚠️ Hints penalty: -10 (1 hints × 10)
  ⚠️ Discussion penalty: -10 (2 turns × 5)
  ⚠️ Clarification penalty: -15 (3 excessive × 5)
📊 Score Calculation:
   Base (mostly_correct): 80
   Total Deductions: -35
   Final Score: 45/100
```

### Test 7: Wrong Approach (20-40)
**Setup:**
- Write incorrect solution (wrong algorithm)
- Use 2 hints trying to fix it
- Have 4 discussion turns

**Expected:**
```
🎯 Technical Correctness: incorrect → Base Score: 40
  ⚠️ Hints penalty: -20 (2 hints × 10)
  ⚠️ Discussion penalty: -20 (4 turns × 5)
📊 Score Calculation:
   Base (incorrect): 40
   Total Deductions: -40
   Final Score: 0/100
```

### Test 8: Discussion Doesn't Penalize Perfect Solutions
**Setup:**
- Discuss approach extensively (5 turns)
- Write fully correct solution
- No hints

**Expected:**
```
🎯 Technical Correctness: fully_correct → Base Score: 100
📊 Score Calculation:
   Base (fully_correct): 100
   Total Deductions: -0
   Final Score: 100/100
```
**Note:** Discussion penalty only applies if `technical_correctness != "fully_correct"`

### Test 9: Multiple Questions - Scores Vary
**Setup:**
- Question 1: Perfect (100)
- Question 2: 1 hint (90)
- Question 3: Mostly correct (80)
- Question 4: Wrong + hints (20)

**Expected:**
```
Average Score: (100 + 90 + 80 + 20) / 4 = 72.5
```

## Testing Instructions

### Manual Testing
1. Start interview with topic selection
2. For each test scenario:
   - Note the setup requirements
   - Perform actions (hints, discussion, code submission)
   - Check backend logs for score breakdown
   - Verify final score matches expected

### Check Backend Logs
Look for these patterns:
```
🎯 Technical Correctness: [level] → Base Score: [score]
  ⚠️ Hints penalty: -[amount]
  ⚠️ Discussion penalty: -[amount]
  ⚠️ Clarification penalty: -[amount]
📊 Score Calculation:
   Base ([level]): [base]
   Total Deductions: -[total]
   Final Score: [final]/100
```

### Verify Database
```sql
SELECT 
    session_id,
    completed_questions,
    average_score,
    individual_scores
FROM interviews
WHERE interview_type = 'technical'
ORDER BY created_at DESC
LIMIT 1;
```

Check that:
- `individual_scores` contains varied scores (not all 85)
- `average_score` is calculated correctly
- Scores reflect interview behavior

## Clarification Question Detection

The system detects clarification questions by looking for:
- Question marks: `?`
- Question words: `what`, `how`, `why`, `can you`, `could you`, `explain`, `clarify`

**Examples Detected as Clarifications:**
- "What should I return for empty input?"
- "How do I handle negative numbers?"
- "Can you explain the third test case?"
- "Could you clarify the time complexity requirement?"

**Not Detected:**
- "I will use a hash map" (statement)
- "The algorithm works by iterating" (explanation)

## Discussion Turn Detection

Every voice interaction counts as a discussion turn:
- Explaining approach
- Asking questions
- Responding to interviewer
- Thinking aloud

**Penalty Logic:**
- If `fully_correct`: NO penalty (discussion helped)
- If `mostly_correct` or `incorrect`: -5 per turn (indicates struggling)

## Edge Cases

### Empty/Minimal Code
- Fallback heuristic: `base_score = 40` (incorrect)
- Same deduction formula applies

### LLM Returns Invalid Correctness
- Default to `"incorrect"` (base = 40)
- Logged as warning

### LLM Unavailable
- Use fallback heuristic scoring
- Same deduction formula
- Logged as "⚠️ Using fallback evaluation"

---
**Status:** Ready for Testing
**Created:** Based on [TECHNICAL_SCORING_FIX.md](TECHNICAL_SCORING_FIX.md)
