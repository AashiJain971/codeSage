# Technical Interview Scoring - Deterministic Implementation

## Problem Fixed
Technical interview scores were biased and effectively hardcoded at ~85, regardless of:
- Hint usage
- Discussion count  
- Clarification questions
- Solution correctness

## Solution Implemented

### 1. Three-Level Correctness Classification

The LLM now classifies code into one of three levels:

| Level | Meaning | Base Score |
|-------|---------|------------|
| `fully_correct` | Logic sound, handles edge cases, implementation correct | **100** |
| `mostly_correct` | Core logic correct, minor bugs/syntax/missed 1-2 edge cases | **80** |
| `incorrect` | Wrong approach or fundamentally broken logic | **40** |

### 2. Deterministic Scoring Formula

```
final_score = base_score - deductions

where deductions =
  (hints_used × 10) +
  (discussion_turns × 5) +        # only if not fully_correct
  (excess_clarifications × 5)     # only if > 2 clarifications

Clamped to [0, 100]
```

### 3. Scoring Examples

#### Perfect Solution
- Correctness: `fully_correct`
- Hints: 0
- Discussion: 0
- **Score: 100** ✅

#### Correct with 1 Hint
- Correctness: `fully_correct`
- Hints: 1
- Discussion: 0
- **Score: 90** (100 - 10)

#### Mostly Correct, No Help
- Correctness: `mostly_correct`
- Hints: 0
- Discussion: 0
- **Score: 80**

#### Mostly Correct with Debugging
- Correctness: `mostly_correct`
- Hints: 1
- Discussion: 3 turns
- **Score: 55** (80 - 10 - 15)

#### Wrong Approach
- Correctness: `incorrect`
- Hints: 2
- Discussion: 5 turns
- **Score: 0** (40 - 20 - 25, clamped to 0)

## Changes Made

### Added Session Tracking
**File:** [ws_server.py](backend/ws_server.py#L304-L305)

```python
self.discussion_turns = 0  # Track number of discussion interactions
self.clarification_questions = 0  # Track clarification questions
```

### Enhanced Voice Response Tracking
**File:** [ws_server.py](backend/ws_server.py#L494-L509)

Now automatically detects:
- Discussion turns (every voice interaction)
- Clarification questions (contains `?`, `what`, `how`, `why`, `explain`, etc.)

```python
def add_voice_response(self, transcript: str, response_type: str = "approach"):
    # ... existing code ...
    
    # Track discussion metrics
    self.discussion_turns += 1
    
    # Detect clarification questions
    transcript_lower = transcript.lower()
    if '?' in transcript or any(word in transcript_lower for word in 
        ['what', 'how', 'why', 'can you', 'could you', 'explain', 'clarify']):
        self.clarification_questions += 1
```

### Per-Question Counter Reset
**File:** [ws_server.py](backend/ws_server.py#L476-L483)

```python
def next_question(self):
    # ... existing resets ...
    
    # Reset per-question counters
    self.discussion_turns = 0
    self.clarification_questions = 0
```

### Updated LLM Evaluation Prompt
**File:** [ws_server.py](backend/ws_server.py#L2126-L2158)

**Before:** Asked LLM to assign a score (resulted in biased ~85)

**After:** Ask LLM only for correctness classification

```python
Evaluation Criteria:
You must classify the technical correctness into ONE of these three levels:

1. "fully_correct": Logic is sound, handles edge cases, implementation is correct
2. "mostly_correct": Core logic correct but has minor bugs, syntax issues, or missed 1-2 edge cases
3. "incorrect": Wrong approach, fundamentally broken logic, or doesn't solve the problem

DO NOT assign a numerical score. Only evaluate correctness level and provide feedback.

Respond exactly like this:
{
    "technical_correctness": "fully_correct",
    "feedback": "Brief overall assessment of the solution",
    "correctness_reason": "Why this correctness level was assigned",
    "edge_cases_handled": ["edge case 1", "edge case 2"],
    "areas_for_improvement": ["improvement 1", "improvement 2"]
}
```

### Deterministic Score Calculation
**File:** [ws_server.py](backend/ws_server.py#L2218-L2264)

```python
# Determine base score from correctness level
base_score_map = {
    "fully_correct": 100,
    "mostly_correct": 80,
    "incorrect": 40
}
base_score = base_score_map.get(technical_correctness, 40)

# Apply deterministic deductions
deductions = 0

# Hints penalty: -10 per hint
hints_penalty = hints_used * 10
deductions += hints_penalty

# Discussion turns penalty: -5 per turn
# Only penalize if solution is not fully correct
if technical_correctness != "fully_correct" and session.discussion_turns > 0:
    discussion_penalty = session.discussion_turns * 5
    deductions += discussion_penalty

# Clarification penalty: -5 per excessive clarification (>2)
if session.clarification_questions > 2:
    clarification_penalty = (session.clarification_questions - 2) * 5
    deductions += clarification_penalty

# Calculate final score
final_score = max(0, min(100, base_score - deductions))
```

### Updated Fallback Evaluation
**File:** [ws_server.py](backend/ws_server.py#L2273-L2330)

**Removed:** Biased default score of 70
**Added:** Heuristic correctness detection + same deduction formula

```python
# Heuristic correctness detection
if has_function and has_logic and has_structure:
    base_score = 80  # mostly_correct
elif has_function or (has_logic and has_structure):
    base_score = 60  # partially_correct
else:
    base_score = 40  # incorrect

# Apply same deductions as LLM path
deductions = (hints_used × 10) + (discussion_turns × 5) + (excess_clarifications × 5)
final_score = max(0, min(100, base_score - deductions))
```

## Detailed Logging

The system now provides detailed score breakdowns:

```
🎯 Technical Correctness: fully_correct → Base Score: 100
  ⚠️ Hints penalty: -10 (1 hints × 10)
📊 Score Calculation:
   Base (fully_correct): 100
   Total Deductions: -10
   Final Score: 90/100
```

## Database Storage

Evaluations are stored with full context:

```python
session.final_evaluation = {
    "technical_correctness": "fully_correct",
    "final_score": 90,
    "base_score": 100,
    "deductions": 10,
    "feedback": "...",
    "correctness_reason": "...",
    "edge_cases_handled": [...],
    "areas_for_improvement": [...]
}
```

## Expected Behavior After Fix

### Scenario 1: Perfect Solution
- Write correct code
- No hints
- No discussion needed
- **Result: 100/100** ✅

### Scenario 2: Solution with 1 Hint
- Write correct code
- Use 1 hint
- **Result: 90/100** ✅

### Scenario 3: Correct After Discussion
- Write correct code
- Discuss approach (3 turns)
- **Result: 100/100** (no penalty for discussion if fully correct) ✅

### Scenario 4: Mostly Correct
- Core logic right, minor bug
- No hints
- **Result: 80/100** ✅

### Scenario 5: Mostly Correct + Debugging
- Core logic right, minor bug
- 2 hints used
- 4 discussion turns
- **Result: 40/100** (80 - 20 - 20) ✅

### Scenario 6: Wrong Approach
- Fundamentally incorrect
- Many hints and clarifications
- **Result: <40/100** ✅

## No More Random 85!

The old system would return ~85 for almost any correct solution.

**New system:**
- Correct + independent = **100**
- Correct + some help = **70-95**
- Mostly correct = **50-80**
- Incorrect = **0-40**

## Validation

### No Hardcoded Defaults
❌ Removed: `base_score = 70` (biased default)
❌ Removed: LLM-assigned score (unreliable)
✅ Added: Three-level correctness classification
✅ Added: Deterministic deduction formula

### Per-Question Scoring
✅ Counters reset for each question
✅ Scores calculated independently
✅ Average = sum(scores) / count (no rounding until final)

### Constraints Met
✅ No database schema changes
✅ No subjective "overall rating"
✅ Interview flow unchanged
✅ All scores clamped 0-100

## Testing Checklist

- [ ] Correct solution, no help → Score = 100
- [ ] Correct solution, 1 hint → Score = 90
- [ ] Correct solution, 2 hints → Score = 80
- [ ] Mostly correct, no help → Score = 80
- [ ] Mostly correct, 1 hint, 2 discussion turns → Score = 60
- [ ] Incorrect solution → Score < 50
- [ ] Multiple questions → Scores vary independently
- [ ] Average calculated correctly across questions
- [ ] Logs show base score + deductions breakdown

---
**Status:** ✅ Implementation Complete
**Files Modified:** [ws_server.py](backend/ws_server.py)
**Breaking Changes:** None (backward compatible)
