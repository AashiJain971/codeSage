import os
import json
import uuid
import tempfile
import asyncio
import subprocess
import time
import csv
import io
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
import jwt
from jwt import PyJWTError

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Query, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

# Import all functions from existing modules
from utils import TOPIC_OPTIONS, build_interviewer_prompt, record_with_vad
from interview import transcript_is_valid, transcribe, interviewer_reply, INTERVIEWER_PROMPT
from interview_with_resume import read_resume
from groq import Groq

# Import database operations
from database import db

# Import final results enrichment
from final_results_enrichment import enrich_resume_interview_results, enrich_technical_interview_results

# Get JWT secret for token verification
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Authentication helper function
async def get_current_user(authorization: str = Header(None)) -> str:
    """Extract and verify user ID from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        # Extract token from "Bearer <token>"
        token = authorization.replace("Bearer ", "")
        
        if SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET != "your-jwt-secret-from-supabase-dashboard-settings-api":
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Fallback for development
            payload = jwt.decode(token, options={"verify_signature": False})
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        
        return user_id
    except PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

# Initialize FastAPI app
app = FastAPI(title="CodeSage Backend API")

# Add CORS middleware (allow production and local dev UIs)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://codesage-5iht.onrender.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Render
@app.get("/health")
async def health_check():
    """Health check endpoint for Render monitoring"""
    try:
        # Verify critical services
        db_connected = True if db else False
        groq_available = True if client else False
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "healthy",
                "service": "codesage-backend",
                "timestamp": datetime.now().isoformat(),
                "database": "connected" if db_connected else "disconnected",
                "groq_api": "available" if groq_available else "unavailable",
                "dependencies": {
                    "pyaudio": True,
                    "webrtcvad": True,
                    "sounddevice": True,
                    "soundfile": True,
                }
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )

# Initialize Groq client for LLM-based questions
api_key = os.getenv("GROQ_API_KEY")
print(f"🔑 API Key status: {'✅ Found' if api_key else '❌ Missing'}")
if api_key:
    print(f"🔑 API Key length: {len(api_key)} characters")
    print(f"🔑 API Key starts with: {api_key[:8]}...")

if not api_key:
    print("WARNING: GROQ_API_KEY not found in environment variables")
    print("Add your API key to .env file or set as environment variable")
    client = None
else:
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully")
        
        # Test the client immediately
        try:
            test_response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": "Reply with just: OK"}],
                temperature=0.1,
                max_tokens=10
            )
            test_content = test_response.choices[0].message.content
            print(f"🧪 Client test successful: '{test_content}'")
        except Exception as test_e:
            print(f"⚠️ Client test failed: {test_e}")
            client = None
            
    except Exception as e:
        print(f"❌ Failed to initialize Groq client: {e}")
        client = None


# -----------------------------
# Technical Interview Questions Database - Now LLM-Generated
# -----------------------------
def extract_json_from_response(response_text: str) -> str:
    """
    Extract JSON from LLM response that might contain extra text
    """
    import re
    
    # Try to find JSON within the response
    json_pattern = r'\{.*\}'
    matches = re.findall(json_pattern, response_text, re.DOTALL)
    
    if matches:
        # Return the largest JSON-like match (most likely to be complete)
        return max(matches, key=len)
    
    return response_text.strip()


def repair_json_string(json_str: str) -> str:
    """
    Attempt to repair common JSON formatting issues
    """
    import re
    
    # Remove any leading/trailing whitespace
    json_str = json_str.strip()
    
    # Remove any markdown code block markers
    json_str = re.sub(r'^```json\s*', '', json_str, flags=re.MULTILINE)
    json_str = re.sub(r'^```\s*', '', json_str, flags=re.MULTILINE)
    json_str = re.sub(r'```\s*$', '', json_str, flags=re.MULTILINE)
    
    # Fix common quote issues
    json_str = re.sub(r'[\u201c\u201d]', '"', json_str)  # Replace smart quotes
    json_str = re.sub(r'[\u2018\u2019]', "'", json_str)  # Replace smart apostrophes
    
    return json_str.strip()


def generate_technical_question(topics: List[str], difficulty: str = "medium") -> dict:
    """
    Generate a technical interview question using LLM based on selected topics
    """
    import json
    
    print(f"🎯 Generating {difficulty} question for topics: {topics}")
    
    if not client:
        print("❌ Groq client not available, using fallback question")
        # Generate a more specific fallback question based on topics
        topic_name = topics[0] if topics else "Data Structures"
        specific_questions = {
            "Arrays": "Given an array of integers, find the maximum sum of a contiguous subarray. Implement a solution and explain your approach.",
            "Strings": "Given a string, find the longest substring without repeating characters. Explain your approach and implement the solution.",
            "Linked Lists": "Reverse a singly linked list. Explain your approach, handle edge cases, and implement the solution.",
            "Trees": "Given a binary tree, find its maximum depth. Explain your approach and implement the solution.",
            "Graphs": "Given a directed graph, implement a function to detect if there is a cycle. Explain your approach using DFS or similar algorithm.",
            "Dynamic Programming": "Given an array of integers, find the length of the longest increasing subsequence. Explain your approach and implement the solution.",
            "Sorting": "Implement merge sort algorithm. Explain the approach, time complexity, and implement the solution.",
            "Binary Search": "Given a sorted array and a target value, implement binary search to find the index of the target. Explain edge cases."
        }
        fallback = {
            "question": specific_questions.get(topic_name, f"Given a problem involving {topic_name}, implement an efficient solution. Start by explaining your approach, discussing time/space complexity, and then write the code."),
            "difficulty": difficulty,
            "topics": topics,
            "hints": ["Think about the data structures you need", "Consider the time complexity", "Don't forget edge cases"],
            "test_cases": [{"input": "test input", "output": "expected output", "explanation": "basic test case"}],
            "evaluation_criteria": ["Problem approach", "Code implementation", "Edge cases"]
        }
        print(f"📝 Fallback question: {fallback['question'][:50]}...")
        return fallback
        
    topics_str = ", ".join(topics)
    
    # Retry logic for LLM call
    max_retries = 2
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                print(f"🔄 Retry attempt {attempt + 1}/{max_retries}")
                import time
                time.sleep(1)  # Wait 1 second before retry
            
            return _generate_question_with_llm(topics, topics_str, difficulty)
        except Exception as e:
            print(f"⚠️ Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                # Final attempt failed, use fallback
                print("❌ All retries exhausted, using fallback")
                raise
    
    # Should not reach here, but just in case
    raise Exception("Question generation failed after all retries")


def _generate_question_with_llm(topics: List[str], topics_str: str, difficulty: str) -> dict:
    """
    Internal function to generate question with LLM (separated for retry logic)
    """
    import json
    
    prompt = f"""
You are a senior technical interviewer. Generate a SPECIFIC, DETAILED coding interview question as a JSON object.

Topics: {topics_str}
Difficulty: {difficulty}

CRITICAL REQUIREMENTS:
1. The question MUST be specific and detailed - NOT vague like "solve a problem related to X"
2. Include concrete examples with sample inputs and expected outputs
3. Clearly state what the function should do
4. For graph problems: specify if directed/undirected, weighted/unweighted, what to return
5. For array problems: specify constraints, what to find/return
6. For string problems: specify exact requirements

BAD EXAMPLE (too vague): "Write a function to solve a hard problem related to Graphs"
GOOD EXAMPLE: "Given a directed weighted graph represented as an adjacency list, implement Dijkstra's algorithm to find the shortest path from a source node to all other nodes. Return a dictionary mapping each node to its shortest distance from the source."

Format your response exactly like this (no extra text, no markdown):

{{
    "question": "Write a SPECIFIC problem with clear requirements, constraints, and examples. Include sample input/output.",
    "difficulty": "{difficulty}",
    "topics": {json.dumps(topics)},
    "hints": [
        "Helpful hint 1",
        "Helpful hint 2", 
        "Helpful hint 3"
    ],
    "test_cases": [
        {{"input": "sample input", "output": "expected output", "explanation": "test description"}}
    ],
    "evaluation_criteria": [
        "Problem understanding and approach discussion",
        "Code correctness and implementation quality"
    ]
}}
"""
    
    print(f"📤 Sending prompt to LLM...")
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a technical interviewer. Always respond with valid JSON only. Never use markdown formatting or extra text."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,  # Very low temperature for consistent formatting
            max_tokens=800,  # Increased from 600 to ensure complete questions
            timeout=30  # 30 second timeout to avoid hanging
        )
        
        response_content = response.choices[0].message.content
        print(f"📥 Raw LLM Response Length: {len(response_content) if response_content else 0}")
        print(f"📥 Raw LLM Response Preview: {response_content[:100] if response_content else 'EMPTY'}...")
        
        if not response_content or response_content.strip() == "":
            print("❌ Empty response from LLM for question generation")
            raise Exception("Empty LLM response")
        
        # Clean response immediately
        response_content = response_content.strip()
        original_content = response_content
        
        # Remove any markdown code block markers
        if response_content.startswith('```'):
            lines = response_content.split('\n')
            # Remove first line if it's ```json or ```
            if lines[0].strip() in ['```json', '```']:
                lines = lines[1:]
            # Remove last line if it's ```
            if lines[-1].strip() == '```':
                lines = lines[:-1]
            response_content = '\n'.join(lines).strip()
        
        print(f"🧹 Cleaned Response Length: {len(response_content)}")
        print(f"🧹 Cleaned Response Preview: {response_content[:100]}...")
        
        if original_content != response_content:
            print("✂️ Markdown cleanup applied")
        
        question_data = json.loads(response_content)
        print(f"✅ JSON parsing successful")
        
        # Validate required fields
        if not isinstance(question_data, dict) or 'question' not in question_data:
            print(f"❌ Invalid question data structure: {type(question_data)}")
            raise Exception("Invalid question format")
        
        print(f"📋 Generated question: {question_data['question'][:50]}...")
        
        # Ensure all required fields have default values
        question_data.setdefault('difficulty', difficulty)
        question_data.setdefault('topics', topics)
        question_data.setdefault('hints', ["Consider the problem step by step", "Think about edge cases", "Optimize your solution"])
        question_data.setdefault('test_cases', [{"input": "example", "output": "result", "explanation": "test case"}])
        question_data.setdefault('evaluation_criteria', ["Correctness", "Approach", "Code quality"])
        
        return question_data
            
    except Exception as e:
        print(f"❌ Error generating question: {e}")
        import traceback
        traceback.print_exc()
        # Fallback to a simple question
        return {
            "question": f"Write a function to solve a {difficulty} problem related to {topics_str}. Explain your approach first.",
            "difficulty": difficulty,
            "topics": topics,
            "hints": ["Think about the data structures you need", "Consider the time complexity", "Don't forget edge cases"],
            "test_cases": [{"input": "test input", "output": "expected output", "explanation": "basic test case"}],
            "evaluation_criteria": ["Problem approach", "Code implementation", "Edge cases"]
        }

# -----------------------------
# Technical Interview Session Management
# -----------------------------
class TechnicalSession:
    def __init__(self, topics: List[str], user_id: str):
        print(f"🏁 Initializing TechnicalSession with topics: {topics} for user: {user_id}")
        self.topics = topics
        self.user_id = user_id
        self.questions = []
        self.current_question_index = 0
        self.session_id = str(uuid.uuid4())
        self.start_time = time.time()
        self.end_time = None
        self.question_start_time = time.time()
        self.hints_used = 0
        self.scores = []
        self.approach_discussed = False
        self.voice_responses = []
        self.code_submissions = []
        self.final_evaluation = None  # Store detailed LLM evaluation
        self.question_submitted = False  # Track if current question was already submitted
        self.interview_id = None  # Will be set when creating database record
        self.discussion_turns = 0  # Track number of discussion interactions
        self.clarification_questions = 0  # Track number of clarification questions asked
        self.questions_ready = False  # Track if questions have been generated
        
        print(f"🔧 Client status: {'✅ Available' if client else '❌ Not available'}")
        print(f"🎯 Session initialization complete (questions will be generated asynchronously)")
    
    async def generate_questions_async(self):
        """Generate questions asynchronously to avoid blocking the WebSocket"""
        # Generate questions using LLM based on selected topics
        difficulties = ["easy", "medium", "hard", "very hard"]  # Progressive difficulty - all different
        print(f"📝 Starting to generate {len(difficulties)} questions...")
        
        generated_questions_text = []  # Track question text to avoid duplicates
        
        for i, difficulty in enumerate(difficulties):
            if i < 4:  # Generate up to 4 questions
                print(f"📝 Generating question {i+1}/{len(difficulties)} (difficulty: {difficulty})")
                
                # Add small delay between requests to avoid rate limiting
                if i > 0:
                    await asyncio.sleep(0.3)  # 300ms delay between question generations
                
                max_retries = 3
                for retry in range(max_retries):
                    try:
                        # Run in executor to avoid blocking
                        loop = asyncio.get_event_loop()
                        question = await loop.run_in_executor(
                            None, 
                            generate_technical_question, 
                            self.topics, 
                            difficulty
                        )
                        
                        question_text = question.get('question', '')
                        
                        # Check for duplicate questions
                        is_duplicate = False
                        for existing_q in generated_questions_text:
                            # Simple similarity check - if 80% of words match, consider duplicate
                            existing_words = set(existing_q.lower().split())
                            new_words = set(question_text.lower().split())
                            if len(existing_words) > 0 and len(new_words) > 0:
                                overlap = len(existing_words.intersection(new_words))
                                similarity = overlap / max(len(existing_words), len(new_words))
                                if similarity > 0.8:
                                    is_duplicate = True
                                    print(f"⚠️ Duplicate detected (similarity: {similarity:.2f}), regenerating...")
                                    break
                        
                        if not is_duplicate:
                            question['id'] = i + 1
                            question['question_number'] = i + 1  # Explicit question number
                            self.questions.append(question)
                            generated_questions_text.append(question_text)
                            print(f"✅ Question {i+1} generated successfully: {question_text[:70]}...")
                            break  # Success, exit retry loop
                        elif retry < max_retries - 1:
                            print(f"🔄 Retrying question {i+1} (attempt {retry+2}/{max_retries})...")
                            await asyncio.sleep(0.5)  # Wait before retry
                        else:
                            print(f"⚠️ Max retries reached, using fallback for question {i+1}")
                            raise Exception("Max retries for unique question")
                            
                    except Exception as e:
                        if retry == max_retries - 1:
                            print(f"❌ Failed to generate question {i+1} after {max_retries} attempts: {e}")
                            # Add fallback question with unique content
                            fallback_question = {
                                "id": i + 1,
                                "question_number": i + 1,
                                "question": f"Question {i+1}: Write a {difficulty}-level function related to {', '.join(self.topics)}. Requirements: Handle edge cases, optimize for time complexity, and explain your approach.",
                                "difficulty": difficulty,
                                "topics": self.topics,
                                "hints": ["Think step by step", "Consider edge cases", "What's the time complexity?"],
                                "test_cases": [{"input": "example", "output": "result", "explanation": "test"}],
                                "evaluation_criteria": ["Correctness", "Efficiency", "Code quality"]
                            }
                            self.questions.append(fallback_question)
                            generated_questions_text.append(fallback_question['question'])
                            print(f"🔄 Added unique fallback question {i+1}")
                            break
        
        self.questions_ready = True
        print(f"🎯 Question generation complete. Generated {len(self.questions)} unique questions")
        print(f"📋 Question difficulties: {[q.get('difficulty') for q in self.questions]}")
        
        # Initialize database record
        await self._initialize_database_record()
    
    async def _initialize_database_record(self):
        """Initialize the database record for this interview session"""
        try:
            session_data = {
                "session_id": self.session_id,
                "interview_type": "technical",
                "topics": self.topics,
                "start_time": self.start_time,
                "total_questions": len(self.questions)
            }
            
            self.interview_id = await db.create_interview_session(session_data, self.user_id)
            if self.interview_id:
                print(f"✅ Database record created with interview_id: {self.interview_id}")
            else:
                print("⚠️ Failed to create database record")
        except Exception as e:
            print(f"❌ Error initializing database record: {e}")
    
    async def update_progress_in_db(self):
        """Update interview progress in database"""
        try:
            progress_data = {
                "current_question_index": self.current_question_index,
                "completed_questions": len([s for s in self.scores if s is not None])
            }
            await db.update_interview_progress(self.session_id, progress_data)
        except Exception as e:
            print(f"❌ Error updating progress in database: {e}")
    
    async def store_question_response_in_db(self, question_index: int, user_response: str, score: int, feedback: str, language: str = "python"):
        """Store individual question response in database"""
        try:
            # Convert internal 0-based question_index to 1-based for storage
            db_question_index = int(question_index) + 1
            if question_index < len(self.questions):
                question = self.questions[question_index]

                question_data = {
                    "question": question.get("question"),
                    "user_response": user_response,
                    "score": score,
                    "feedback": feedback,
                    "time_taken": int(time.time() - self.question_start_time),
                    "hints_used": self.hints_used,
                    "difficulty": question.get("difficulty", "medium"),
                    "language": language
                }

                await db.store_question_response(self.session_id, db_question_index, question_data)
        except Exception as e:
            print(f"❌ Error storing question response in database: {e}")
    
    async def complete_interview_in_db(self, final_results: Dict):
        """Mark interview as completed in database"""
        try:
            self.end_time = time.time()

            # Normalize timestamps to ISO strings for DB storage
            try:
                iso_end_time = datetime.fromtimestamp(self.end_time).isoformat()
            except Exception:
                iso_end_time = None
            try:
                iso_start_time = datetime.fromtimestamp(self.start_time).isoformat() if self.start_time else None
            except Exception:
                iso_start_time = None

            # Ensure individual scores are numbers
            normalized_scores = [float(s) if isinstance(s, (int, float)) else 0 for s in self.scores]

            # ✅ Extract completion_method from evaluation_metadata (single source of truth)
            completion_method = final_results.get("evaluation_metadata", {}).get("completion_method", "automatic")

            # ✅ final_results already contains all enriched data from LLM
            # We need to update it with DB-specific fields, not wrap it
            results_data = {
                "end_time": iso_end_time,
                "start_time": iso_start_time,
                "duration": int(self.end_time - self.start_time) if self.start_time else 0,
                "total_time": int(self.end_time - self.start_time) if self.start_time else 0,
                "completed_questions": len([s for s in self.scores if s is not None]),
                "average_score": float(self.get_final_score()),
                "individual_scores": normalized_scores if normalized_scores else [float(s) for s in self.scores],
                "final_results": final_results,  # ✅ This IS the enriched data
                "completion_method": completion_method
            }
            print(f"[DB DEBUG] Writing interview completion: {json.dumps(results_data, default=str)[:500]}")

            print(f"📊 Attempting to complete interview in database:")
            print(f"   Session ID: {self.session_id}")
            print(f"   End Time: {results_data.get('end_time')}")
            print(f"   Duration: {results_data.get('total_time')} seconds")
            print(f"   Completed Questions: {results_data.get('completed_questions')}")
            print(f"   Average Score: {results_data.get('average_score')}")

            # First ensure the session exists in the database
            if not self.interview_id:
                print("🔄 Session not found in database, creating it first...")
                session_data = {
                    "session_id": self.session_id,
                    "interview_type": "technical",
                    "topics": self.topics,
                    "start_time": self.start_time,
                    "total_questions": len(self.questions)
                }
                self.interview_id = await db.create_interview_session(session_data)
                if not self.interview_id:
                    print("❌ Failed to create session record, cannot complete interview")
                    return False
                print(f"✅ Session record created: {self.interview_id}")

            success = await db.complete_interview(self.session_id, results_data)

            if success:
                print(f"✅ Interview completion successful in database")
                return True
            else:
                print(f"❌ Interview completion failed in database")
                return False

        except Exception as e:
            print(f"❌ Error completing interview in database: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_current_question(self):
        if self.current_question_index < len(self.questions):
            return self.questions[self.current_question_index]
        return None
    
    def next_question(self):
        self.current_question_index += 1
        self.question_start_time = time.time()
        self.hints_used = 0
        self.approach_discussed = False
        self.question_submitted = False  # Reset for new question
        
        # Reset per-question counters
        self.discussion_turns = 0
        self.clarification_questions = 0
        
        # Update progress in database
        asyncio.create_task(self.update_progress_in_db())
        
        return self.get_current_question()
    
    def add_score(self, score: int):
        self.scores.append(score)
    
    def get_final_score(self):
        return sum(self.scores) / len(self.scores) if self.scores else 0
    
    def add_voice_response(self, transcript: str, response_type: str = "approach"):
        """Track voice responses for approach discussion analysis"""
        self.voice_responses.append({
            "transcript": transcript,
            "type": response_type,
            "timestamp": time.time(),
            "question_id": self.current_question_index + 1
        })
        
        # Track discussion metrics
        self.discussion_turns += 1
        
        # Detect clarification questions (contains '?', 'what', 'how', 'why', 'can you', etc.)
        transcript_lower = transcript.lower()
        if '?' in transcript or any(word in transcript_lower for word in ['what', 'how', 'why', 'can you', 'could you', 'explain', 'clarify']):
            self.clarification_questions += 1
    
    def add_code_submission(self, code: str, language: str):
        """Track code submissions for analysis"""
        self.code_submissions.append({
            "code": code,
            "language": language,
            "timestamp": time.time(),
            "question_id": self.current_question_index + 1,
            "hints_used_so_far": self.hints_used
        })


# -----------------------------
# Scoring Helpers
# -----------------------------
def extract_score_from_evaluation(evaluation_text: str) -> int:
    """
    Extract numerical score from LLM evaluation text.
    Looks for "Rating: X/10" format in the evaluation text.
    Dynamically computes score based on evaluation criteria.
    Returns: integer score (0-100 scale)
    """
    import re
    
    if not evaluation_text:
        print("⚠️ No evaluation text provided, returning default score 50")
        return 50
    
    print(f"🔍 Extracting score from evaluation: '{evaluation_text[:200]}...'")
    
    # PRIORITY 1: Look for explicit "Rating: X/10" format (most reliable)
    rating_match = re.search(r'Rating:\s*(\d+)\s*/\s*10', evaluation_text, re.IGNORECASE)
    if rating_match:
        rating = int(rating_match.group(1))
        normalized = min(100, max(0, rating * 10))  # Convert 0-10 to 0-100
        print(f"✅ FOUND explicit 'Rating: {rating}/10' -> {normalized}/100")
        return normalized
    
    # PRIORITY 2: Look for "X/10" or "X/100" fractional patterns
    fraction_match = re.search(r'(\d+)\s*/\s*(\d+)', evaluation_text)
    if fraction_match:
        score, max_score = int(fraction_match.group(1)), int(fraction_match.group(2))
        if max_score in [10, 100]:
            normalized = int((score / max_score) * 100) if max_score == 10 else score
            normalized = min(100, max(0, normalized))
            print(f"✅ Found fraction {score}/{max_score} -> {normalized}/100")
            return normalized
    
    # PRIORITY 3: Dynamic evaluation scoring based on content analysis
    # Use heuristics to estimate score from evaluation text content
    text_lower = evaluation_text.lower()
    
    # Analyze evaluation for quality indicators
    positive_keywords = ['excellent', 'outstanding', 'strong', 'comprehensive', 'impressive',
                        'detailed', 'insightful', 'thoughtful', 'well-articulated', 'thorough']
    good_keywords = ['good', 'solid', 'clear', 'appropriate', 'demonstrates', 'correct',
                     'shows understanding', 'adequate']
    adequate_keywords = ['partially', 'somewhat', 'could improve', 'missing details', 'brief',
                        'lacks depth', 'incomplete']
    poor_keywords = ['incorrect', 'vague', 'unclear', 'off-topic', 'failed', 'poor',
                     'confused', 'contradicts']
    
    excellent_count = sum(1 for keyword in positive_keywords if keyword in text_lower)
    good_count = sum(1 for keyword in good_keywords if keyword in text_lower)
    adequate_count = sum(1 for keyword in adequate_keywords if keyword in text_lower)
    poor_count = sum(1 for keyword in poor_keywords if keyword in text_lower)
    
    # Calculate weighted score (0-100)
    if excellent_count >= 2:
        base_score = 85 + (excellent_count * 2)
    elif excellent_count >= 1:
        base_score = 80
    elif good_count >= 2:
        base_score = 70 + (good_count * 2)
    elif good_count >= 1:
        base_score = 65
    elif adequate_count >= 2:
        base_score = 50 + (adequate_count * 2)
    else:
        base_score = 55
    
    # Adjust down for poor indicators
    if poor_count > 0:
        base_score = max(20, base_score - (poor_count * 15))
    
    final_score = min(100, max(0, base_score))
    print(f"📊 Dynamic scoring: excellent={excellent_count}, good={good_count}, adequate={adequate_count}, poor={poor_count}")
    print(f"✅ DYNAMIC SCORE COMPUTED: {final_score}/100")
    return final_score

# -----------------------------
# App setup
# -----------------------------
# Note: App and CORS middleware are initialized once at the top

# -----------------------------
# In-memory stores
# -----------------------------
resume_store: dict[str, str] = {}
technical_sessions: dict[str, TechnicalSession] = {}

"""
This server handles both regular interviews and technical coding interviews.
All interview logic (prompts, LLM calls) is delegated to existing functions.
Technical interviews include code evaluation and real-time hints.
"""


# -----------------------------
# HTTP routes
# -----------------------------
@app.get("/")
def root():
    return {"status": "ok", "message": "Interview server running"}


@app.get("/topics")
def list_topics():
    return {"topics": TOPIC_OPTIONS}


@app.post("/upload_resume")
async def upload_resume(file: UploadFile = File(...)):
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF resumes are supported")

    content = await file.read()
    # Persist to a temp file and use the existing read_resume function
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        text = read_resume(tmp_path) or ""
        if not text:
            raise ValueError("Empty text extracted from resume")
        # No easy way to get page count from read_resume; return -1 to indicate unknown
        page_count = -1
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process uploaded PDF: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    resume_id = str(uuid.uuid4())
    resume_store[resume_id] = text
    return {"resume_id": resume_id, "pages": page_count}


@app.post("/transcribe_audio")
async def transcribe_audio(file: UploadFile = File(...)):
    """Accept an uploaded audio blob (webm/wav/ogg/mp3), convert to wav if needed, and return transcript."""
    try:
        # Check if client is available
        if not client:
            print("[TRANSCRIBE] ❌ Groq client not initialized")
            raise HTTPException(
                status_code=500, 
                detail="Groq API client not initialized - check GROQ_API_KEY environment variable"
            )
        
        # Persist upload to a temp file
        suffix = ".wav"
        ct = (file.content_type or "").lower()
        print(f"[TRANSCRIBE] Content-Type: {ct}")
        print(f"[TRANSCRIBE] Filename: {file.filename}")
        
        if "webm" in ct:
            suffix = ".webm"
        elif "ogg" in ct:
            suffix = ".ogg"
        elif "mp3" in ct:
            suffix = ".mp3"
        elif "m4a" in ct or "mp4" in ct:
            suffix = ".m4a"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            print(f"[TRANSCRIBE] Uploaded bytes: {len(content)}")
            if not content or len(content) < 100:
                raise HTTPException(status_code=400, detail="Audio file too small or empty")
            tmp.write(content)
            src_path = tmp.name
        
        print(f"[TRANSCRIBE] Saved to temp file: {src_path}")
        
        # If not wav, convert to wav via ffmpeg
        ext = os.path.splitext(src_path)[1].lower()
        wav_path = src_path
        if ext != ".wav":
            wav_path = src_path.replace(ext, ".wav")
            print(f"[TRANSCRIBE] Converting {ext} to WAV...")
            try:
                proc = subprocess.run([
                    "ffmpeg", "-y", "-i", src_path,
                    "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le",
                    wav_path
                ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
                print(f"[TRANSCRIBE] ✅ ffmpeg conversion OK -> {wav_path}")
                print(f"[TRANSCRIBE] WAV file size: {os.path.getsize(wav_path)} bytes")
            except subprocess.TimeoutExpired:
                print(f"[TRANSCRIBE] ❌ ffmpeg timeout")
                try:
                    os.unlink(src_path)
                except Exception:
                    pass
                raise HTTPException(status_code=400, detail="Audio conversion timeout")
            except subprocess.CalledProcessError as e:
                err = e.stderr.decode("utf-8", errors="ignore") if e.stderr else str(e)
                print(f"[TRANSCRIBE] ❌ ffmpeg error: {err[:500]}")
                try:
                    os.unlink(src_path)
                except Exception:
                    pass
                raise HTTPException(status_code=400, detail=f"Audio conversion failed - invalid format")
            except Exception as e:
                print(f"[TRANSCRIBE] ❌ ffmpeg unexpected error: {e}")
                try:
                    os.unlink(src_path)
                except Exception:
                    pass
                raise HTTPException(status_code=500, detail=f"Audio conversion error: {str(e)[:100]}")
        
        # Transcribe
        try:
            print(f"[TRANSCRIBE] Starting Groq Whisper transcription...")
            transcript = transcribe(wav_path)
            print(f"[TRANSCRIBE] Raw transcript: {transcript}")
            print(f"[TRANSCRIBE] Transcript length: {len(transcript) if transcript else 0}")
            
            # Check if transcript is an error message
            if transcript.startswith("[Transcription"):
                print(f"[TRANSCRIBE] ⚠️ Transcription returned error: {transcript}")
                raise HTTPException(status_code=500, detail=transcript)
                
        finally:
            # Cleanup temp files
            for p in [src_path, wav_path]:
                try:
                    if os.path.exists(p):
                        os.unlink(p)
                        print(f"[TRANSCRIBE] Cleaned up: {p}")
                except Exception as cleanup_err:
                    print(f"[TRANSCRIBE] Cleanup warning: {cleanup_err}")
        
        print(f"[TRANSCRIBE] ✅ Success - returning transcript")
        return {"transcript": transcript}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TRANSCRIBE] ❌ Unexpected server error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)[:200]}")


@app.post("/save_interview_results")
async def save_interview_results(data: dict):
    """Save interview results as JSON file and return download URL"""
    try:
        interview_id = str(uuid.uuid4())
        filename = f"interview_results_{interview_id}.json"
        
        # Create results directory if it doesn't exist
        results_dir = "interview_results"
        os.makedirs(results_dir, exist_ok=True)
        
        # Save the interview data as JSON
        filepath = os.path.join(results_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return {
            "status": "success",
            "interview_id": interview_id,
            "filename": filename,
            "download_url": f"/download_results/{interview_id}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save results: {str(e)}")


@app.get("/download_results/{interview_id}")
async def download_results(interview_id: str):
    """Download interview results JSON file"""
    try:
        filename = f"interview_results_{interview_id}.json"
        filepath = os.path.join("interview_results", filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Interview results not found")
        
        return FileResponse(
            filepath,
            media_type='application/json',
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download results: {str(e)}")


@app.get("/api/interview-results/{session_id}")
async def get_interview_results(session_id: str):
    """Get interview results data for a session from database"""
    try:
        # First try to get from database
        results = await db.get_interview_results(session_id)
        if results:
            return results
        
        # Fallback to file-based results if not in database
        filename = f"interview_results_{session_id}.json"
        filepath = os.path.join("interview_results", filename)
        
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data
        
        raise HTTPException(status_code=404, detail="Interview results not found")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get interview results: {str(e)}")


@app.get("/api/interviews")
async def get_all_interviews(limit: int = 50):
    """Get all interview records from database, formatted for frontend"""
    try:
        interviews = await db.get_all_interviews(limit)
        formatted = [format_interview_data(i) for i in interviews]
        return {"interviews": formatted, "total": len(formatted)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get interviews: {str(e)}")


@app.get("/api/interview-details/{session_id}")
async def get_interview_details(session_id: str):
    """Get detailed interview data including question responses"""
    try:
        # Get main interview data
        interview_data = await db.get_interview_results(session_id)
        if not interview_data:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        # Get question responses
        question_responses = await db.get_question_responses(session_id)
        
        return {
            "interview": interview_data,
            "questions": question_responses
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get interview details: {str(e)}")


# -----------------------------
# Helper Functions for Analytics
# -----------------------------
def calculate_status(completion_method: str, average_score: Optional[int]) -> str:
    """Calculate interview status based on completion method and score"""
    if completion_method == "manually_ended":
        return "manually_ended"
    elif completion_method == "timeout_cleanup":
        return "timeout"
    elif average_score is not None:
        return "approved" if average_score >= 70 else "rejected"
    return "in_progress"


def format_interview_data(interview: Dict[str, Any]) -> Dict[str, Any]:
    """Transform database interview data to frontend format"""
    duration_seconds = interview.get("duration", 0) or 0
    duration_minutes = round(duration_seconds / 60) if duration_seconds > 0 else 0
    
    completion_method = interview.get("completion_method", "automatic")
    average_score = interview.get("average_score")
    status = calculate_status(completion_method, average_score)
    
    final_results = interview.get("final_results", {})
    if isinstance(final_results, str):
        try:
            final_results = json.loads(final_results)
        except:
            final_results = {}
    
    interviewer = final_results.get("interviewer", "AI Interviewer")
    topics = interview.get("topics", [])
    if not topics:
        topics = final_results.get("topics", [])
    
    feedback = final_results.get("overall_feedback", "No feedback available")
    
    return {
        "id": interview.get("session_id"),
        "type": interview.get("interview_type", "technical"),
        "date": interview.get("created_at"),
        "duration": duration_minutes,
        "duration_seconds": duration_seconds,
        "score": average_score or 0,
        "status": status,
        "topics": topics,
        "questions_completed": interview.get("completed_questions", 0),
        "total_questions": interview.get("total_questions", 0),
        "interviewer": interviewer,
        "feedback": feedback,
        "completion_method": completion_method,
        "individual_scores": interview.get("individual_scores", []),
        "start_time": interview.get("start_time"),
        "end_time": interview.get("end_time"),
        "final_results": final_results
    }


# -----------------------------
# Analytics & Stats Endpoints
# -----------------------------
@app.get("/api/interviews/stats/overview")
async def get_stats_overview():
    """Get overall statistics and metrics"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        total = len(formatted)
        if total == 0:
            return {
                "total": 0, "approved": 0, "rejected": 0,
                "manually_ended": 0, "timeout": 0, "average_score": 0,
                "average_duration": 0, "total_questions_answered": 0,
                "completion_rate": 0
            }
        
        approved = len([i for i in formatted if i["status"] == "approved"])
        rejected = len([i for i in formatted if i["status"] == "rejected"])
        manually_ended = len([i for i in formatted if i["status"] == "manually_ended"])
        timeout = len([i for i in formatted if i["status"] == "timeout"])
        
        scores = [i["score"] for i in formatted if i["score"] > 0]
        average_score = round(sum(scores) / len(scores)) if scores else 0
        
        durations = [i["duration"] for i in formatted if i["duration"] > 0]
        average_duration = round(sum(durations) / len(durations)) if durations else 0
        
        total_questions = sum(i["questions_completed"] for i in formatted)
        expected_questions = sum(i["total_questions"] for i in formatted)
        completion_rate = round((total_questions / expected_questions * 100)) if expected_questions > 0 else 0
        
        return {
            "total": total, "approved": approved, "rejected": rejected,
            "manually_ended": manually_ended, "timeout": timeout,
            "average_score": average_score, "average_duration": average_duration,
            "total_questions_answered": total_questions,
            "completion_rate": completion_rate
        }
    except Exception as e:
        print(f"❌ Error in get_stats_overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/stats")
async def get_stats_alias():
    """Compatibility endpoint used by the frontend; returns the same overview stats."""
    return await get_stats_overview()


@app.get("/api/interviews/analytics/performance")
async def get_performance_analytics():
    """Get detailed performance analytics including topic breakdown and trends"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        if not formatted:
            return {
                "topic_performance": [], "score_distribution": {},
                "time_efficiency": {}, "improvement_trend": [],
                "consistency_score": 0
            }
        
        topic_scores = defaultdict(list)
        for interview in formatted:
            for topic in interview.get("topics", []):
                if interview["score"] > 0:
                    topic_scores[topic].append(interview["score"])
        
        topic_performance = [
            {
                "topic": topic,
                "average_score": round(sum(scores) / len(scores)),
                "attempts": len(scores),
                "max_score": max(scores),
                "min_score": min(scores)
            }
            for topic, scores in topic_scores.items()
        ]
        topic_performance.sort(key=lambda x: x["average_score"], reverse=True)
        
        score_ranges = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
        for interview in formatted:
            score = interview["score"]
            if score <= 20:
                score_ranges["0-20"] += 1
            elif score <= 40:
                score_ranges["21-40"] += 1
            elif score <= 60:
                score_ranges["41-60"] += 1
            elif score <= 80:
                score_ranges["61-80"] += 1
            else:
                score_ranges["81-100"] += 1
        
        sorted_interviews = sorted(formatted, key=lambda x: x["date"])
        recent_interviews = sorted_interviews[-10:]
        improvement_trend = [
            {"date": i["date"], "score": i["score"], "interview_number": idx + 1}
            for idx, i in enumerate(recent_interviews)
        ]
        
        scores = [i["score"] for i in formatted if i["score"] > 0]
        if len(scores) > 1:
            mean_score = sum(scores) / len(scores)
            variance = sum((s - mean_score) ** 2 for s in scores) / len(scores)
            std_dev = variance ** 0.5
            consistency_score = max(0, round(100 - std_dev))
        else:
            consistency_score = 100
        
        return {
            "topic_performance": topic_performance,
            "score_distribution": score_ranges,
            "time_efficiency": {"average": 0},
            "improvement_trend": improvement_trend,
            "consistency_score": consistency_score
        }
    except Exception as e:
        print(f"❌ Error in get_performance_analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/analytics/insights")
async def get_performance_insights():
    """Get AI-generated performance insights and recommendations"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        if not formatted:
            return {"strengths": [], "areas_for_improvement": [], "recommendations": []}
        
        topic_scores = defaultdict(list)
        for interview in formatted:
            for topic in interview.get("topics", []):
                if interview["score"] > 0:
                    topic_scores[topic].append(interview["score"])
        
        strengths = []
        weaknesses = []
        
        for topic, scores in topic_scores.items():
            avg = sum(scores) / len(scores)
            if avg >= 80:
                strengths.append({
                    "topic": topic,
                    "average_score": round(avg),
                    "description": f"Excellent performance in {topic}"
                })
            elif avg < 60:
                weaknesses.append({
                    "topic": topic,
                    "average_score": round(avg),
                    "description": f"Need improvement in {topic}"
                })
        
        recommendations = []
        total_expected = sum(i["total_questions"] for i in formatted)
        total_completed = sum(i["questions_completed"] for i in formatted)
        if total_expected > 0:
            completion_rate = (total_completed / total_expected) * 100
            if completion_rate < 80:
                recommendations.append({
                    "category": "Time Management",
                    "suggestion": "Focus on completing more questions. Try time-boxing each question.",
                    "priority": "high"
                })
        
        return {
            "strengths": strengths,
            "areas_for_improvement": weaknesses,
            "recommendations": recommendations
        }
    except Exception as e:
        print(f"❌ Error in get_performance_insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/export")
async def export_interviews(
    format: str = Query("csv", regex="^(csv|json)$"),
    status_filter: Optional[str] = Query(None)
):
    """Export interview data in CSV or JSON format"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        if status_filter:
            formatted = [i for i in formatted if i["status"] == status_filter]
        
        if format == "csv":
            output = io.StringIO()
            if formatted:
                fieldnames = ["id", "type", "date", "duration", "score", "status",
                             "questions_completed", "total_questions", "interviewer", "completion_method"]
                writer = csv.DictWriter(output, fieldnames=fieldnames)
                writer.writeheader()
                
                for interview in formatted:
                    writer.writerow({
                        "id": interview["id"],
                        "type": interview["type"],
                        "date": interview["date"],
                        "duration": interview["duration"],
                        "score": interview["score"],
                        "status": interview["status"],
                        "questions_completed": interview["questions_completed"],
                        "total_questions": interview["total_questions"],
                        "interviewer": interview["interviewer"],
                        "completion_method": interview["completion_method"]
                    })
            
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=interviews_{datetime.now().strftime('%Y%m%d')}.csv"}
            )
        else:
            return JSONResponse(
                content={"interviews": formatted, "exported_at": datetime.now().isoformat()},
                headers={"Content-Disposition": f"attachment; filename=interviews_{datetime.now().strftime('%Y%m%d')}.json"}
            )
    except Exception as e:
        print(f"❌ Error in export_interviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def generate_swot_analysis(completed_interviews: List[Dict], skills: Dict, stats: Dict, interview_list: List[Dict]) -> Dict:
    """
    Generate comprehensive SWOC/T analysis using LLM based on all interview data.
    Analyzes: Technical skills, Behavioral skills, Problem-solving, Communication, Growth trajectory
    """
    if not client or not completed_interviews:
        return None
    
    try:
        # Prepare interview summary for LLM
        interview_summary = []
        for interview in interview_list[:15]:  # Recent 15 interviews
            final_results = interview.get("final_results", {})
            interview_summary.append({
                "type": interview["type"],
                "date": interview["date"],
                "score": interview["score"],
                "topics": interview["topics"],
                "duration_minutes": round(interview.get("duration_seconds", 0) / 60, 1),
                "questions_completed": interview.get("questions_completed", 0),
                "feedback_summary": final_results.get("feedback", "") if isinstance(final_results, dict) else ""
            })
        
        # Build comprehensive prompt
        prompt = f"""You are an expert technical recruiter and career advisor analyzing a candidate's interview performance data.

CANDIDATE PERFORMANCE DATA:
==========================

Overall Statistics:
- Total Interviews: {stats['total_interviews']}
- Average Score: {stats['average_score']:.1f}%
- Completion Rate: {stats['completion_rate']:.1f}%
- Performance Trend: {stats['trend']}
- Total Questions Attempted: {stats['total_questions']}

Skill Breakdown (0-100%):
- Problem Solving: {skills.get('problem_solving', 0):.1f}%
- Communication: {skills.get('communication', 0):.1f}%
- Code Quality: {skills.get('code_quality', 0):.1f}%
- Technical Depth: {skills.get('technical_depth', 0):.1f}%
- System Design: {skills.get('system_design', 0):.1f}%
- Behavioral/Soft Skills: {skills.get('behavioral', 0):.1f}%

Recent Interview History:
{json.dumps(interview_summary, indent=2)}

TASK:
=====
Provide a comprehensive SWOC/T (Strengths, Weaknesses, Opportunities, Challenges/Threats) analysis.

Your analysis should:
1. **STRENGTHS**: Identify 4-6 key strengths across technical skills, behavioral competencies, problem-solving ability, communication, consistency, and growth trajectory. Be specific with percentages and evidence.

2. **WEAKNESSES**: Identify 4-6 areas needing improvement. Include technical gaps, behavioral concerns, and performance inconsistencies. Be constructive and specific.

3. **OPPORTUNITIES**: Identify 4-6 growth opportunities based on current skill level and market trends. Suggest specific technical domains, learning paths, or interview strategies.

4. **CHALLENGES/THREATS**: Identify 4-6 challenges or potential obstacles. Consider skill gaps relative to industry standards, competitive pressures, and areas requiring urgent attention.

5. **CURRENT_STAGE**: Provide a 1-2 sentence assessment of where the candidate stands (e.g., "Junior Developer", "Mid-Level SWE Ready", "Senior IC Track").

6. **LONGITUDINAL_GROWTH**: Provide a 2-3 sentence analysis of growth trajectory based on trend and score progression.

7. **KEY_RECOMMENDATIONS**: Provide 3-4 specific, actionable recommendations prioritized by impact.

8. **TECHNICAL_READINESS**: Rate readiness for technical interviews (0-100%) with brief justification.

9. **BEHAVIORAL_READINESS**: Rate readiness for behavioral interviews (0-100%) with brief justification.

RESPONSE FORMAT (JSON):
{{
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "opportunities": ["opportunity 1", "opportunity 2", ...],
  "threats": ["challenge/threat 1", "challenge/threat 2", ...],
  "current_stage": "assessment of current level",
  "longitudinal_growth": "analysis of growth trajectory and trends",
  "key_recommendations": ["recommendation 1", "recommendation 2", ...],
  "technical_readiness": {{"score": 0-100, "justification": "brief explanation"}},
  "behavioral_readiness": {{"score": 0-100, "justification": "brief explanation"}},
  "detailed_breakdown": {{
    "hard_skills": {{"assessment": "detailed assessment", "score": 0-100}},
    "soft_skills": {{"assessment": "detailed assessment", "score": 0-100}},
    "problem_solving": {{"assessment": "detailed assessment", "score": 0-100}},
    "communication": {{"assessment": "detailed assessment", "score": 0-100}},
    "consistency": {{"assessment": "detailed assessment", "score": 0-100}},
    "growth_mindset": {{"assessment": "detailed assessment", "score": 0-100}}
  }}
}}

Be honest, specific, and actionable. Use data points from the interview history to support your analysis."""

        # Call LLM
        print(f"🎯 Generating SWOC/T analysis for {stats['total_interviews']} interviews...")
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=3000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Extract JSON from response
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        swot_data = json.loads(content)
        print(f"✅ SWOC/T analysis generated successfully")
        return swot_data
        
    except Exception as e:
        print(f"❌ Error generating SWOC/T analysis: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.get("/api/profile")
async def get_user_profile(user_id: str = Depends(get_current_user)):
    """Get comprehensive user profile with skills, performance, and interview history"""
    try:
        # Fetch all interviews for this user
        all_interviews = await db.get_user_interviews(user_id, limit=1000)
        
        if not all_interviews:
            # Return empty profile for new users
            return {
                "user": {
                    "id": user_id,
                    "email": "",
                    "created_at": datetime.now().isoformat()
                },
                "stats": {
                    "total_interviews": 0,
                    "average_score": 0,
                    "highest_score": 0,
                    "total_duration_hours": 0,
                    "total_questions": 0,
                    "completion_rate": 0
                },
                "skills": {
                    "problem_solving": 0,
                    "communication": 0,
                    "code_quality": 0,
                    "technical_depth": 0,
                    "system_design": 0,
                    "behavioral": 0
                },
                "performance": {
                    "trend": "stable",
                    "recent_scores": [],
                    "dates": []
                },
                "interviews": [],
                "strengths": [],
                "improvements": [],
                "trustScore": 0
            }
        
        # Format interviews
        formatted_interviews = [format_interview_data(interview) for interview in all_interviews]
        completed_interviews = [i for i in formatted_interviews if i["status"] in ["approved", "rejected"]]
        
        # Calculate statistics
        total_interviews = len(completed_interviews)
        scores = [i["score"] for i in completed_interviews if i["score"] > 0]
        average_score = sum(scores) / len(scores) if scores else 0
        highest_score = max(scores) if scores else 0
        total_duration = sum(i["duration_seconds"] for i in completed_interviews)
        total_questions = sum(i["questions_completed"] for i in completed_interviews)
        completion_rate = (sum(i["questions_completed"] for i in completed_interviews) / 
                          sum(i["total_questions"] for i in completed_interviews) * 100 
                          if sum(i["total_questions"] for i in completed_interviews) > 0 else 0)
        
        # Calculate skills (weighted average from recent interviews)
        recent_interviews = sorted(completed_interviews, key=lambda x: x["date"], reverse=True)[:10]
        
        # Simple skill calculation based on scores and interview types
        skills = {
            "problem_solving": 0,
            "communication": 0,
            "code_quality": 0,
            "technical_depth": 0,
            "system_design": 0,
            "behavioral": 0
        }
        
        if recent_interviews:
            # Calculate skills based on interview performance
            for interview in recent_interviews:
                score = interview["score"]
                final_results = interview.get("final_results", {})
                
                # Extract skill metrics from final results if available
                if isinstance(final_results, dict):
                    skills["problem_solving"] += final_results.get("problem_solving_score", score)
                    skills["communication"] += final_results.get("communication_score", score * 0.9)
                    skills["code_quality"] += final_results.get("code_quality_score", score * 0.85)
                    skills["technical_depth"] += final_results.get("technical_depth_score", score * 0.95)
                    skills["system_design"] += final_results.get("system_design_score", score * 0.8)
                    skills["behavioral"] += final_results.get("behavioral_score", score * 0.75)
                else:
                    # Default calculation based on overall score
                    skills["problem_solving"] += score
                    skills["communication"] += score * 0.9
                    skills["code_quality"] += score * 0.85
                    skills["technical_depth"] += score * 0.95
                    skills["system_design"] += score * 0.8
                    skills["behavioral"] += score * 0.75
            
            # Average the skills
            num_interviews = len(recent_interviews)
            skills = {k: round(v / num_interviews, 1) for k, v in skills.items()}
        
        # Calculate performance trend
        if len(completed_interviews) >= 3:
            sorted_by_date = sorted(completed_interviews, key=lambda x: x["date"])
            recent_half = sorted_by_date[len(sorted_by_date)//2:]
            older_half = sorted_by_date[:len(sorted_by_date)//2]
            
            recent_avg = sum(i["score"] for i in recent_half) / len(recent_half) if recent_half else 0
            older_avg = sum(i["score"] for i in older_half) / len(older_half) if older_half else 0
            
            if recent_avg > older_avg + 5:
                trend = "improving"
            elif recent_avg < older_avg - 5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        # Get recent scores and dates for chart
        recent_for_chart = sorted(completed_interviews, key=lambda x: x["date"], reverse=True)[:15]
        recent_for_chart.reverse()  # Oldest to newest for chart
        recent_scores = [i["score"] for i in recent_for_chart]
        recent_dates = [i["date"] for i in recent_for_chart]
        
        # Sort interviews by date for analysis (need this before SWOC/T generation)
        sorted_interviews = sorted(formatted_interviews, key=lambda x: x["date"], reverse=True)
        
        # Generate comprehensive SWOC/T analysis using LLM
        swot_analysis = await generate_swot_analysis(
            completed_interviews=completed_interviews,
            skills=skills,
            stats={
                "total_interviews": total_interviews,
                "average_score": average_score,
                "completion_rate": completion_rate,
                "trend": trend,
                "total_questions": total_questions
            },
            interview_list=sorted_interviews[:20]  # Use recent 20 for analysis
        )
        
        # Fallback to simple analysis if LLM fails
        if not swot_analysis or not swot_analysis.get("strengths"):
            strengths = []
            improvements = []
            
            sorted_skills = sorted(skills.items(), key=lambda x: x[1], reverse=True)
            for skill, value in sorted_skills[:3]:
                if value >= 70:
                    strengths.append(f"Strong {skill.replace('_', ' ')} capabilities ({value}%)")
            
            for skill, value in sorted_skills[-3:]:
                if value < 70:
                    improvements.append(f"Develop {skill.replace('_', ' ')} skills (currently {value}%)")
            
            if completion_rate >= 80:
                strengths.append(f"High completion rate ({completion_rate:.0f}%)")
            if average_score >= 75:
                strengths.append(f"Consistent high performance (avg {average_score:.0f}%)")
            if trend == "improving":
                strengths.append("Demonstrating continuous improvement")
            
            if not strengths:
                strengths = ["Active interview participant", "Building technical interview experience"]
            if not improvements:
                improvements = ["Continue practicing to build consistency", "Focus on completing more interviews"]
            
            swot_analysis = {
                "strengths": strengths,
                "weaknesses": improvements,
                "opportunities": ["Expand technical skill range", "Seek real-world project experience"],
                "threats": ["Rapidly evolving technology landscape", "Competitive job market"]
            }
        
        # Calculate trust score
        trust_score = min(100, (
            (total_interviews * 5) +  # 5 points per interview
            (average_score * 0.3) +    # 30% weight on average score
            (completion_rate * 0.2) +  # 20% weight on completion rate
            (20 if trend == "improving" else 10)  # Bonus for improvement
        ))
        
        # Prepare interview list with full details (limit to recent 50)
        interview_list = []
        
        for i in sorted_interviews[:50]:  # Use already sorted list
            # Fetch question responses for this interview using the session_id (stored as 'id' in formatted data)
            session_id = i.get("id")  # format_interview_data sets id = session_id
            questions_data = await db.get_question_responses(session_id) if session_id else []
            
            interview_list.append({
                "id": i["id"],
                "type": i["type"],
                "date": i["date"],
                "score": i["score"],
                "topics": i["topics"],
                "duration": i["duration_seconds"],
                "final_results": i.get("final_results", {}),
                "questions_data": questions_data,
                "code_submissions": i.get("code_submissions", []),
                "voice_responses": i.get("voice_responses", [])
            })
        
        return {
            "user": {
                "id": user_id,
                "email": "",  # Can be populated from user table if available
                "created_at": min(i["date"] for i in formatted_interviews) if formatted_interviews else datetime.now().isoformat()
            },
            "stats": {
                "total_interviews": total_interviews,
                "average_score": round(average_score, 1),
                "highest_score": highest_score,
                "total_duration_hours": round(total_duration / 3600, 1),
                "total_questions": total_questions,
                "completion_rate": round(completion_rate, 1)
            },
            "skills": skills,
            "performance": {
                "trend": trend,
                "recent_scores": recent_scores,
                "dates": recent_dates
            },
            "interviews": interview_list,
            "strengths": swot_analysis.get("strengths", []),
            "improvements": swot_analysis.get("weaknesses", []),
            "swot_analysis": swot_analysis,  # Full SWOC/T breakdown
            "trustScore": round(trust_score, 0)
        }
        
    except Exception as e:
        print(f"❌ Error in get_user_profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/profile/public/{user_id}")
async def get_public_profile(user_id: str):
    """Get public profile view - recruiter/shareable version with limited information"""
    try:
        # Fetch all interviews for this user
        all_interviews = await db.get_user_interviews(user_id, limit=1000)
        
        if not all_interviews:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Format interviews
        formatted_interviews = [format_interview_data(interview) for interview in all_interviews]
        completed_interviews = [i for i in formatted_interviews if i["status"] in ["approved", "rejected"]]
        
        # Calculate statistics
        total_interviews = len(completed_interviews)
        scores = [i["score"] for i in completed_interviews if i["score"] > 0]
        average_score = sum(scores) / len(scores) if scores else 0
        highest_score = max(scores) if scores else 0
        total_duration = sum(i["duration_seconds"] for i in completed_interviews)
        total_questions = sum(i["questions_completed"] for i in completed_interviews)
        completion_rate = (sum(i["questions_completed"] for i in completed_interviews) / 
                          sum(i["total_questions"] for i in completed_interviews) * 100 
                          if sum(i["total_questions"] for i in completed_interviews) > 0 else 0)
        
        # Calculate skills (same as private, but we only expose aggregate)
        recent_interviews = sorted(completed_interviews, key=lambda x: x["date"], reverse=True)[:10]
        
        skills = {
            "problem_solving": 0,
            "communication": 0,
            "code_quality": 0,
            "technical_depth": 0,
            "system_design": 0,
            "behavioral": 0
        }
        
        if recent_interviews:
            for interview in recent_interviews:
                score = interview["score"]
                final_results = interview.get("final_results", {})
                
                if isinstance(final_results, dict):
                    skills["problem_solving"] += final_results.get("problem_solving_score", score)
                    skills["communication"] += final_results.get("communication_score", score * 0.9)
                    skills["code_quality"] += final_results.get("code_quality_score", score * 0.85)
                    skills["technical_depth"] += final_results.get("technical_depth_score", score * 0.95)
                    skills["system_design"] += final_results.get("system_design_score", score * 0.8)
                    skills["behavioral"] += final_results.get("behavioral_score", score * 0.75)
                else:
                    skills["problem_solving"] += score
                    skills["communication"] += score * 0.9
                    skills["code_quality"] += score * 0.85
                    skills["technical_depth"] += score * 0.95
                    skills["system_design"] += score * 0.8
                    skills["behavioral"] += score * 0.75
            
            num_interviews = len(recent_interviews)
            skills = {k: round(v / num_interviews, 1) for k, v in skills.items()}
        
        # Calculate performance trend
        if len(completed_interviews) >= 3:
            sorted_by_date = sorted(completed_interviews, key=lambda x: x["date"])
            recent_half = sorted_by_date[len(sorted_by_date)//2:]
            older_half = sorted_by_date[:len(sorted_by_date)//2]
            
            recent_avg = sum(i["score"] for i in recent_half) / len(recent_half) if recent_half else 0
            older_avg = sum(i["score"] for i in older_half) / len(older_half) if older_half else 0
            
            if recent_avg > older_avg + 5:
                trend = "improving"
            elif recent_avg < older_avg - 5:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        # Generate strengths (public view - only positive highlights)
        strengths = []
        sorted_skills = sorted(skills.items(), key=lambda x: x[1], reverse=True)
        
        for skill, value in sorted_skills[:3]:
            if value >= 70:
                strengths.append(f"Strong {skill.replace('_', ' ')} capabilities ({value}%)")
        
        if completion_rate >= 80:
            strengths.append(f"High completion rate ({completion_rate:.0f}%)")
        if average_score >= 75:
            strengths.append(f"Consistent high performance (avg {average_score:.0f}%)")
        if trend == "improving":
            strengths.append("Demonstrating continuous improvement")
        
        if not strengths:
            strengths = [
                "Active interview participant",
                "Building technical interview experience",
                "Committed to skill development"
            ]
        
        # Calculate trust score
        trust_score = min(100, (
            (total_interviews * 5) +
            (average_score * 0.3) +
            (completion_rate * 0.2) +
            (20 if trend == "improving" else 10)
        ))
        
        # Return public profile (no sensitive data)
        return {
            "user": {
                "id": user_id,
                "created_at": min(i["date"] for i in formatted_interviews) if formatted_interviews else datetime.now().isoformat()
            },
            "stats": {
                "total_interviews": total_interviews,
                "average_score": round(average_score, 1),
                "highest_score": highest_score,
                "total_duration_hours": round(total_duration / 3600, 1),
                "total_questions": total_questions,
                "completion_rate": round(completion_rate, 1)
            },
            "skills": skills,
            "performance": {
                "trend": trend
            },
            "strengths": strengths,
            "trustScore": round(trust_score, 0)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_public_profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# WebSocket endpoint
# -----------------------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    
    # Extract and verify authentication token from query params
    user_id = None
    try:
        # Get token from query parameter
        query_params = dict(ws.query_params)
        token = query_params.get("token")
        
        if not token:
            await ws.send_text(json.dumps({
                "type": "error",
                "error": "Authentication required. Please login first."
            }))
            await ws.close(code=1008, reason="Authentication required")
            return
        
        # Verify JWT token
        if SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET != "your-jwt-secret-from-supabase-dashboard-settings-api":
            print("🔐 Verifying JWT token with secret...")
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Fallback: decode without verification (development only)
            print("⚠️ WARNING: JWT verification disabled - using fallback mode")
            payload = jwt.decode(token, options={"verify_signature": False})
        
        user_id = payload.get("sub")
        if not user_id:
            raise Exception("Invalid token: missing user ID")
        
        print(f"✅ Resume WebSocket authenticated for user: {user_id}")
        
    except PyJWTError as e:
        print(f"❌ JWT Error in resume WebSocket: {e}")
        await ws.send_text(json.dumps({
            "type": "error",
            "error": f"Invalid authentication token: {str(e)}"
        }))
        await ws.close(code=1008, reason="Invalid token")
        return
    except Exception as e:
        print(f"❌ Authentication error in resume WebSocket: {e}")
        import traceback
        traceback.print_exc()
        await ws.send_text(json.dumps({
            "type": "error",
            "error": f"Authentication failed: {str(e)}"
        }))
        await ws.close(code=1008, reason="Authentication failed")
        return

    session = {
        "prompt": None,
        "conversation": [],
        "session_id": None,
        "interview_id": None,
        "start_time": None,
        "mode": None,
        "user_id": user_id,
        "individual_scores": [],  # Track scores for each question
        "last_question_time": None  # Track time for each question
    }

    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                await ws.send_text(json.dumps({
                    "type": "error", "error": "Invalid JSON message"
                }))
                continue

            mtype = msg.get("type")

            # Force stop handler - immediately terminate interview
            if mtype == "stop_interview":
                session_id = msg.get("session_id", "unknown")
                print(f"🛑 FORCE STOP requested for session: {session_id}")
                
                # Set ended flag immediately
                session["ended"] = True
                session["force_stopped"] = True
                
                # CRITICAL: Save interview results before terminating
                print(f"\n💾 FORCE STOP - Saving interview before termination")
                print(f"Session ID: {session.get('session_id')}")
                print(f"Interview ID: {session.get('interview_id')}")
                print(f"Mode: {session.get('mode')}")
                print(f"Conversation length: {len(session.get('conversation', []))}")
                print(f"Individual scores: {session.get('individual_scores', [])}")
                
                try:
                    if session and "conversation" in session and len(session.get("conversation", [])) > 0:
                        # Use existing interview_id from session
                        interview_id = session.get("interview_id")
                        if not interview_id:
                            interview_id = str(uuid.uuid4())
                            print(f"⚠️ WARNING: No interview_id in session, creating new one: {interview_id}")
                        
                        end_time = time.time()
                        conversation = session.get("conversation", [])
                        individual_scores = session.get("individual_scores", [])
                        
                        if session.get("session_id") and interview_id:
                            print(f"\n💾 SAVING {session.get('mode', 'unknown').upper()} INTERVIEW TO DATABASE (FORCE STOP)...")
                            
                            # Calculate duration
                            duration = int(end_time - session.get("start_time", end_time))
                            print(f"Duration: {duration}s ({duration//60}m {duration%60}s)")
                            
                            # Calculate scores
                            if individual_scores:
                                average_score = round(sum(individual_scores) / len(individual_scores))
                            else:
                                average_score = 0
                            
                            completed_questions = len(conversation)
                            
                            print(f"   ✓ Completed questions: {completed_questions}")
                            print(f"   ✓ Individual scores: {individual_scores}")
                            print(f"   ✓ Average score: {average_score}/100")
                            
                            # Transform conversation for enrichment
                            print("\n🤖 Enriching final_results...")
                            transformed_conversation = []
                            for entry in conversation:
                                if isinstance(entry, dict):
                                    question_text = entry.get('next_question') or entry.get('content', '')
                                    answer_text = entry.get('candidate') or entry.get('content', '')
                                    eval_text = entry.get('evaluation', '')
                                    score = entry.get('score', 0)
                                    
                                    if question_text or answer_text:
                                        transformed_conversation.append({
                                            "question": question_text,
                                            "answer": answer_text,
                                            "evaluation": eval_text,
                                            "score": score / 10 if score > 10 else score
                                        })
                            
                            try:
                                enriched_final_results = enrich_resume_interview_results(
                                    conversation=transformed_conversation,
                                    individual_scores=individual_scores,
                                    average_score=average_score,
                                    duration=duration,
                                    resume_text=session.get("resume_text", "")
                                )
                                print("✅ LLM enrichment successful")
                            except Exception as e:
                                print(f"⚠️ LLM enrichment failed: {e}")
                                enriched_final_results = {
                                    "interview_type": "resume",
                                    "interview_summary": {
                                        "overall_assessment": f"Interview force-stopped with {len(individual_scores)} questions answered",
                                        "hire_recommendation": "borderline" if average_score < 70 else "yes",
                                        "confidence_level": "medium"
                                    },
                                    "evaluation_metadata": {
                                        "evaluation_model": "fallback",
                                        "scoring_method": "basic",
                                        "completion_method": "force_stopped",
                                        "signals_used": ["conversation_length", "scores"]
                                    }
                                }
                            
                            # Build final_results_data
                            final_results_data = {
                                **enriched_final_results,
                                "interview_id": interview_id,
                                "timestamp": datetime.now().isoformat(),
                                "conversation": conversation,
                                "resume_id": session.get("resume_id"),
                                "topics": session.get("topics", []),
                                "total_interactions": len(conversation),
                                "individual_scores": individual_scores,
                                "questions_answered": len(individual_scores),
                                "completed_questions": completed_questions,
                                "average_score": average_score,
                                "duration": duration
                            }
                            
                            if "evaluation_metadata" in final_results_data:
                                final_results_data["evaluation_metadata"]["completion_method"] = "force_stopped"
                            
                            # Save to database
                            results_data = {
                                "end_time": end_time,
                                "duration": duration,
                                "total_time": duration,
                                "completed_questions": completed_questions,
                                "current_question_index": completed_questions,
                                "average_score": average_score,
                                "individual_scores": individual_scores,
                                "final_results": final_results_data,
                                "completion_method": "force_stopped"
                            }
                            
                            print(f"\n📦 Saving to database...")
                            success = await db.complete_interview(session["session_id"], results_data)
                            if success:
                                print("✅ Force-stopped interview saved successfully")
                            else:
                                print(f"❌ DATABASE SAVE FAILED")
                        else:
                            print(f"⚠️ Cannot save - missing session_id or interview_id")
                    else:
                        print("⚠️ No conversation data to save")
                except Exception as e:
                    print(f"❌ ERROR saving force-stopped interview: {e}")
                    import traceback
                    traceback.print_exc()
                
                # Send acknowledgment
                await ws.send_text(json.dumps({
                    "type": "interview_stopped",
                    "message": "Interview forcefully terminated",
                    "timestamp": datetime.now().isoformat()
                }))
                
                # Break out of loop to close connection
                print(f"✅ Force stop acknowledged, terminating WebSocket")
                break

            if mtype == "init":
                mode = msg.get("mode")  # "topics" | "resume"
                if mode == "topics":
                    topics = msg.get("topics") or []
                    if not isinstance(topics, list) or not topics:
                        await ws.send_text(json.dumps({
                            "type": "error", "error": "Provide non-empty 'topics' list"
                        }))
                        continue
                    # Store session info
                    session["mode"] = mode
                    session["topics"] = topics
                    # Build and set prompt via existing module
                    prompt = build_interviewer_prompt(topics)
                    # Append jargon correction instruction as in interview.py
                    prompt += (
                        "\nIf the candidate uses a technical term or jargon that is misspelled or not recognized "
                        "(for example, 'kosarachi' instead of 'kosaraju'), try to infer the intended word and "
                        "suggest the closest possible correct term in your feedback."
                    )
                    import interview
                    interview.INTERVIEWER_PROMPT = prompt
                    session["prompt"] = prompt
                    await ws.send_text(json.dumps({
                        "type": "ready",
                        "message": "Topic-based interview initialized",
                        "next_question": "Let's begin. Can you introduce yourself?"
                    }))
                elif mode == "resume":
                    resume_id = msg.get("resume_id")
                    if not resume_id or resume_id not in resume_store:
                        await ws.send_text(json.dumps({
                            "type": "error", "error": "Invalid or missing resume_id"
                        }))
                        continue
                    
                    # Create database session for resume interview
                    session_id = str(uuid.uuid4())
                    start_time = time.time()
                    session["session_id"] = session_id
                    session["start_time"] = start_time
                    session["last_question_time"] = start_time  # Initialize for first question timing
                    session["mode"] = mode
                    session["resume_id"] = resume_id
                    
                    # Create interview session in database
                    session_data = {
                        "session_id": session_id,
                        "interview_type": "resume",
                        "topics": ["Resume-Based"],
                        "start_time": start_time,
                        "total_questions": 0  # Will be updated dynamically as questions are asked
                    }
                    interview_id = await db.create_interview_session(session_data, user_id)
                    session["interview_id"] = interview_id
                    print(f"✅ Resume interview session created: {session_id} (DB ID: {interview_id})")
                    print(f"📊 Session state after init: session_id={session['session_id']}, interview_id={session['interview_id']}")
                    
                    resume_text = resume_store[resume_id]
                    # Resume-based prompt. Avoid f-string so JSON braces remain literal.
                    prompt = """
You are **CodeSage**, an AI technical interviewer.
You are conducting a live mock job interview with the candidate, using their resume as the primary source for questions.

### Interview Context:
- The candidate's resume is provided below. Use its content to guide your questions.
- Focus on their experience, skills, education, and projects mentioned in the resume.
- If name is different from resume, use the name provided in the resume and do not prompt them to confirm.
- If the candidate mentions a project or experience not in the resume, politely ask them to clarify or provide more details.
- If the candidate says "Thank you" , treat it as if the candidate is silent and prompt them to continue.

### Interview Topics:
- Only ask questions directly related to the candidate's resume content.

### Interview Style:
- Speak in a natural, conversational tone.
- Keep answers concise (2–3 sentences max), like a real interviewer.
- Encourage the candidate to think aloud.
- Adapt follow-up questions based on their last response and resume details.
- Be supportive but professional.

### Tasks:
1. For general questions:
    - Evaluate the candidate's response briefly (clarity, correctness, confidence).
    - If the answer is incomplete, politely nudge for more detail.
    - Ask the next resume-based question.

2. For technical or project questions:
    - Compare the candidate's explanation with what's described in the resume.
    - Judge correctness, depth, and relevance.
    - Suggest improvements or ask for more details if needed.
    - If candidate requests a hint, give only a small clue.

3. Jargon or Misspelling:
    - If the candidate uses a technical term or jargon that is misspelled or not recognized (e.g., "kosarachi" instead of "kosaraju"), try to infer the intended word and suggest the closest possible correct term in your feedback.

4. Final feedback (at end of interview):
    - Summarize overall performance:
      1. Strengths demonstrated
      2. Areas for improvement
      3. Overall confidence level
      4. Recommendation (hire / no hire / needs more practice)

### Response Format:
ALWAYS reply in JSON with this EXACT structure:
{
  "evaluation": "MANDATORY: Brief feedback with EXACTLY 'Rating: X/10' where X is 0-10. Example: 'Rating: 7/10 - Good understanding with clear examples.' Include feedback about technical knowledge, depth, clarity, and resume relevance.",
  "next_question": "Your next question for the candidate.",
  "hint": "Optional hint if asked.",
  "final_feedback": "Only include this at the end."
}

### Evaluation Scoring - CRITICAL:
For EVERY candidate response, assign a score 0-10 BASED ON:

**Evaluation Criteria (Dynamic Real-Time):**
1. Technical/Role Knowledge (30%): Does the answer demonstrate relevant technical skills or role-specific expertise mentioned in their resume?
2. Depth & Examples (25%): Does the candidate provide specific examples, details, or go beyond surface-level explanations?
3. Resume Relevance (20%): Does the answer align with what's stated in their resume? Are they expanding appropriately on resume content?
4. Clarity of Communication (15%): Is the explanation clear, well-structured, and easy to understand?
5. Candidate Initiative (10%): Does the candidate show proactivity, self-correction, or thoughtful discussion beyond just answering?

**Score Scale (0-10):**
- 0-3: Poor (off-topic, vague, contradicts resume, unclear, passive)
- 4-5: Below Average (partially correct but missing key details, lacks depth, some inconsistencies)
- 6-7: Good (correct and clear, matches resume, adequate explanation)
- 8-9: Excellent (detailed with examples, insightful, demonstrates strong expertise, proactive)
- 10: Outstanding (goes beyond expectations, exceptional depth, shows leadership/innovation)

**MANDATORY REQUIREMENT: EVERY evaluation MUST include "Rating: X/10" format. Example: "Rating: 7/10 - Strong technical understanding..."**

Resume:
""" + resume_text
                    import interview
                    interview.INTERVIEWER_PROMPT = prompt
                    session["prompt"] = prompt
                    await ws.send_text(json.dumps({
                        "type": "ready",
                        "message": "Resume-based interview initialized",
                        "next_question": "Thanks for sharing your resume. Could you give a brief overview of your background?"
                    }))
                else:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Unknown mode. Use 'topics' or 'resume'"
                    }))

            elif mtype == "answer":
                if not session.get("prompt"):
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Session not initialized. Send 'init' first."
                    }))
                    continue
                    
                print(f"\n📝 ANSWER HANDLER - Processing text answer")
                print(f"Session state: session_id={session.get('session_id')}, interview_id={session.get('interview_id')}")
                print(f"Mode: {session.get('mode')}")
                
                candidate = msg.get("text", "").strip()
                if not candidate:
                    print("⚠️  Empty answer received")
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Empty answer text"
                    }))
                    continue

                print(f"Candidate response: '{candidate[:100]}...'") 
                
                # Validate transcript - but be lenient
                if not transcript_is_valid(candidate):
                    print(f"⚠️  Invalid transcript (too short or garbled): '{candidate}'")
                    # Still allow single-word answers in case user said "yes", "no", etc.
                    if len(candidate.split()) == 0:
                        await ws.send_text(json.dumps({
                            "type": "error", "error": "Invalid transcript. Please speak more clearly."
                        }))
                        continue
                    # If it's just short, allow it through
                    print(f"ℹ️  Allowing short response: '{candidate}'")

                print("🤖 Getting LLM response...")
                reply = interviewer_reply(candidate, session["conversation"])
                print(f"LLM reply keys: {list(reply.keys())}")
                
                # Extract score from evaluation for resume interviews
                if session.get("mode") == "resume":
                    evaluation_text = reply.get("evaluation", "")
                    print(f"\n📊 SCORE EXTRACTION - Resume Interview")
                    print(f"Full evaluation text: '{evaluation_text}'")
                    
                    score = extract_score_from_evaluation(evaluation_text)
                    print(f"🎯 Final extracted score: {score}/100")
                    
                    # Calculate time taken for this question
                    current_time = time.time()
                    time_taken = int(current_time - session.get("last_question_time", current_time))
                    print(f"⏱️ Time taken: {time_taken}s")
                    
                    # Get next question for proper storage
                    next_question = reply.get("next_question", "Follow-up question")
                    
                    # Store in conversation with score
                    conversation_entry = {
                        "candidate": candidate,
                        "score": score,
                        "time_taken": time_taken,
                        "evaluation": evaluation_text,
                        "next_question": next_question,
                        **reply
                    }
                    session["conversation"].append(conversation_entry)
                    print(f"Added to conversation: Q#{len(session['conversation'])}")
                    
                    # Track score
                    session["individual_scores"].append(score)
                    print(f"Individual scores so far: {session['individual_scores']}")
                    
                    # CRITICAL: Update interviews table in REAL-TIME with current scores
                    if session.get("session_id"):
                        try:
                            current_avg = round(sum(session["individual_scores"]) / len(session["individual_scores"]))
                            progress_update = {
                                "completed_questions": len(session["conversation"]),
                                "current_question_index": len(session["conversation"]),
                                "average_score": current_avg,
                                "individual_scores": session["individual_scores"]
                            }
                            await db.update_interview_progress(session["session_id"], progress_update)
                            print(f"✅ REAL-TIME UPDATE: interviews table updated with avg={current_avg}, scores={session['individual_scores']}")
                        except Exception as e:
                            print(f"⚠️ Failed to update interviews table in real-time: {e}")
                    
                    # Store in database (question_responses table)
                    print(f"\n💾 DATABASE STORAGE ATTEMPT")
                    print(f"session_id: {session.get('session_id')}")
                    print(f"interview_id: {session.get('interview_id')}")
                    
                    if session.get("session_id") and session.get("interview_id"):
                        question_index = len(session["conversation"])
                        
                        # Derive difficulty from score and response depth
                        response_length = len(candidate.split())
                        if score >= 80 and response_length > 50:
                            difficulty = "advanced"
                        elif score >= 60 and response_length > 30:
                            difficulty = "intermediate"
                        else:
                            difficulty = "conversational"
                        
                        # Get the PREVIOUS question (what was asked) not the next question
                        if len(session["conversation"]) > 1:
                            prev_entry = session["conversation"][-2]
                            question_text = prev_entry.get("next_question", "Previous question")
                        else:
                            # First question
                            question_text = "Thanks for sharing your resume. Could you give a brief overview of your background?"
                        
                        question_data = {
                            "question": question_text,
                            "user_response": candidate,
                            "score": score,
                            "feedback": evaluation_text,
                            "time_taken": time_taken,
                            "hints_used": 0,
                            "difficulty": difficulty
                        }
                        
                        print(f"Question #{question_index} data:")
                        print(f"  - Question: '{question_text[:80]}...'")
                        print(f"  - Response: '{candidate[:80]}...'")
                        print(f"  - Score: {score}")
                        print(f"  - Difficulty: {difficulty}")
                        print(f"  - Time: {time_taken}s")
                        print(f"  - Feedback length: {len(evaluation_text)} chars")
                        
                        try:
                            db_result = await db.store_question_response(
                                session["session_id"],
                                question_index,
                                question_data
                            )
                            if db_result:
                                print(f"✅ STORED to database: Q#{question_index} (score={score}, difficulty={difficulty})")
                            else:
                                print(f"❌ Database store returned False for Q#{question_index}")
                        except Exception as e:
                            print(f"❌ Failed to store Q&A: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print("❌ SKIPPING database storage - missing session_id or interview_id")
                        print(f"  session_id: {session.get('session_id')}")
                        print(f"  interview_id: {session.get('interview_id')}")
                    
                    # Reset time for next question
                    session["last_question_time"] = current_time
                    print(f"Updated last_question_time for next question\n")
                else:
                    # Technical interviews don't use this path
                    session["conversation"].append({
                        "candidate": candidate,
                        **reply
                    })
                
                await ws.send_text(json.dumps({"type": "assessment", **reply}))

            elif mtype == "code_submission":
                if not session.get("prompt"):
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Session not initialized. Send 'init' first."
                    }))
                    continue
                    
                print(f"\n💻 CODE SUBMISSION HANDLER - Processing code")
                print(f"Session state: session_id={session.get('session_id')}, interview_id={session.get('interview_id')}")
                
                code = msg.get("code", "").strip()
                if not code:
                    print("⚠️ Empty code submission")
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Empty code submission"
                    }))
                    continue

                print(f"Code length: {len(code)} characters, {len(code.split(chr(10)))} lines")

                # Process code submission like a regular answer
                candidate_message = f"[Code Submission]\n{code}"
                print("🤖 Getting LLM evaluation for code...")
                reply = interviewer_reply(candidate_message, session["conversation"])
                print(f"LLM reply keys: {list(reply.keys())}")
                
                # Extract score from evaluation for resume interviews
                if session.get("mode") == "resume":
                    evaluation_text = reply.get("evaluation", "")
                    print(f"\n📊 SCORE EXTRACTION - Code Submission")
                    print(f"Full evaluation: '{evaluation_text}'")
                    
                    score = extract_score_from_evaluation(evaluation_text)
                    print(f"🎯 Final code score: {score}/100")
                    
                    # Calculate time taken
                    current_time = time.time()
                    time_taken = int(current_time - session.get("last_question_time", current_time))
                    print(f"⏱️ Time taken: {time_taken}s")
                    
                    # Get next question
                    next_question = reply.get("next_question", "Follow-up question")
                    
                    # Store in conversation with score
                    conversation_entry = {
                        "candidate": candidate_message,
                        "score": score,
                        "time_taken": time_taken,
                        "evaluation": evaluation_text,
                        "next_question": next_question,
                        **reply
                    }
                    session["conversation"].append(conversation_entry)
                    print(f"Added code submission to conversation: Q#{len(session['conversation'])}")
                    
                    # Track score
                    session["individual_scores"].append(score)
                    print(f"Individual scores so far: {session['individual_scores']}")
                    
                    # CRITICAL: Update interviews table in REAL-TIME with current scores
                    if session.get("session_id"):
                        try:
                            current_avg = round(sum(session["individual_scores"]) / len(session["individual_scores"]))
                            progress_update = {
                                "completed_questions": len(session["conversation"]),
                                "current_question_index": len(session["conversation"]),
                                "average_score": current_avg,
                                "individual_scores": session["individual_scores"]
                            }
                            await db.update_interview_progress(session["session_id"], progress_update)
                            print(f"✅ REAL-TIME UPDATE: interviews table updated with avg={current_avg}, scores={session['individual_scores']}")
                        except Exception as e:
                            print(f"⚠️ Failed to update interviews table in real-time: {e}")
                    
                    # Store in database
                    print(f"\n💾 DATABASE STORAGE ATTEMPT (code)")
                    print(f"session_id: {session.get('session_id')}")
                    print(f"interview_id: {session.get('interview_id')}")
                    
                    if session.get("session_id") and session.get("interview_id"):
                        question_index = len(session["conversation"])
                        
                        # Get the previous question (what was asked)
                        if len(session["conversation"]) > 1:
                            prev_entry = session["conversation"][-2]
                            question_text = prev_entry.get("next_question", "Code challenge")
                        else:
                            question_text = "Code challenge"
                        
                        # Derive difficulty - code submissions are typically more advanced
                        code_length = len(code.split('\n'))
                        if score >= 80 and code_length > 10:
                            difficulty = "advanced"
                        elif score >= 60:
                            difficulty = "intermediate"
                        else:
                            difficulty = "conversational"
                        
                        question_data = {
                            "question": question_text,
                            "user_response": candidate_message,
                            "score": score,
                            "feedback": evaluation_text,
                            "time_taken": time_taken,
                            "hints_used": 0,
                            "difficulty": difficulty
                        }
                        
                        print(f"Code question #{question_index} data:")
                        print(f"  - Question: '{question_text[:80]}...'")
                        print(f"  - Code lines: {code_length}")
                        print(f"  - Score: {score}")
                        print(f"  - Difficulty: {difficulty}")
                        print(f"  - Time: {time_taken}s")
                        
                        try:
                            db_result = await db.store_question_response(
                                session["session_id"],
                                question_index,
                                question_data
                            )
                            if db_result:
                                print(f"✅ STORED code submission to database: Q#{question_index}")
                            else:
                                print(f"❌ Database store returned False for code Q#{question_index}")
                        except Exception as e:
                            print(f"❌ Failed to store code submission: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print("❌ SKIPPING database storage - missing session_id or interview_id")
                        print(f"  session_id: {session.get('session_id')}")
                        print(f"  interview_id: {session.get('interview_id')}")
                    
                    # Reset time
                    session["last_question_time"] = current_time
                    print(f"Updated last_question_time for next question\n")
                else:
                    # Technical interviews
                    session["conversation"].append({
                        "candidate": candidate_message,
                        **reply
                    })
                
                await ws.send_text(json.dumps({"type": "assessment", **reply}))

            elif mtype == "record_audio":
                # Check if interview has ended
                if session.get("ended", False):
                    print("⚠️ Ignoring record_audio - interview already ended")
                    break
                    
                await ws.send_text(json.dumps({"type": "listening", "message": "Listening for speech..."}))
                try:
                    filename = f"ws_ans_{len(session['conversation'])}.wav"
                    print(f"🎙️  Starting audio recording for {filename}...")
                    recorded_file, heard_speech = record_with_vad(filename)
                    
                    if not heard_speech:
                        print("❌ No speech detected in recording")
                        await ws.send_text(json.dumps({
                            "type": "no_speech",
                            "message": "No speech detected. Please speak louder or check your microphone."
                        }))
                        continue
                    
                    print(f"🎤 Audio recorded successfully, transcribing {recorded_file}...")
                    candidate = transcribe(recorded_file)
                    print(f"📝 Transcription result: '{candidate}'")
                    
                    try:
                        os.remove(recorded_file)
                    except Exception:
                        pass
                    
                    if not transcript_is_valid(candidate):
                        print(f"⚠️  Invalid transcript detected: '{candidate}'")
                        await ws.send_text(json.dumps({
                            "type": "invalid_transcript",
                            "message": "Could not understand. Please repeat more clearly.",
                            "transcript": candidate
                        }))
                        continue
                    
                    print(f"✅ Valid transcript, sending to frontend: '{candidate[:100]}...'")
                    
                    # Send transcript immediately to show in chat
                    await ws.send_text(json.dumps({
                        "type": "transcribed",
                        "transcript": candidate
                    }))
                    
                    # Send AI processing indicator immediately
                    await ws.send_text(json.dumps({
                        "type": "ai_thinking",
                        "message": "AI is processing..."
                    }))
                    
                    print("🤖 Getting AI response...")
                    reply = interviewer_reply(candidate, session["conversation"])
                    
                    # Extract score from evaluation
                    evaluation_text = reply.get("evaluation", "")
                    print(f"📊 DEBUG record_audio - Mode: {session.get('mode')}")
                    print(f"📊 DEBUG record_audio - Full reply: {reply}")
                    print(f"📊 DEBUG record_audio - Evaluation: {evaluation_text[:150] if evaluation_text else 'EMPTY'}...")
                    score = extract_score_from_evaluation(evaluation_text)
                    print(f"📊 DEBUG record_audio - Extracted score: {score}")
                    
                    # Ensure score is valid
                    if score is None or score < 0 or score > 100:
                        print(f"⚠️ Invalid score {score}, using default 50")
                        score = 50
                    
                    # Calculate time taken for this question
                    current_time = time.time()
                    time_taken = int(current_time - session.get("last_question_time", current_time))
                    
                    # Store in conversation with score
                    session["conversation"].append({
                        "candidate": candidate,
                        "score": score,
                        "time_taken": time_taken,
                        **reply
                    })
                    
                    # Track score
                    session["individual_scores"].append(score)
                    
                    # CRITICAL: Update interviews table in REAL-TIME with current scores
                    if session.get("session_id"):
                        try:
                            current_avg = round(sum(session["individual_scores"]) / len(session["individual_scores"]))
                            progress_update = {
                                "completed_questions": len(session["conversation"]),
                                "current_question_index": len(session["conversation"]),
                                "average_score": current_avg,
                                "individual_scores": session["individual_scores"]
                            }
                            await db.update_interview_progress(session["session_id"], progress_update)
                            print(f"✅ REAL-TIME UPDATE: interviews table updated with avg={current_avg}, scores={session['individual_scores']}")
                        except Exception as e:
                            print(f"⚠️ Failed to update interviews table in real-time: {e}")
                    
                    # Store in database (question_responses table)
                    print(f"📊 DEBUG - session_id: {session.get('session_id')}, interview_id: {session.get('interview_id')}")
                    if session.get("session_id") and session.get("interview_id"):
                        question_index = len(session["conversation"])
                        question_text = reply.get("next_question", "Follow-up question")
                        print(f"📝 Preparing to store Q&A #{question_index}")
                        
                        # Derive difficulty from score and response depth
                        # High scores (80+) with good depth = advanced
                        # Medium scores (60-79) or moderate depth = intermediate
                        # Lower scores (<60) or brief responses = conversational
                        response_length = len(candidate.split())
                        if score >= 80 and response_length > 50:
                            difficulty = "advanced"
                        elif score >= 60 and response_length > 30:
                            difficulty = "intermediate"
                        else:
                            difficulty = "conversational"
                        
                        question_data = {
                            "question": question_text,
                            "user_response": candidate,
                            "score": score,
                            "feedback": evaluation_text,
                            "time_taken": time_taken,
                            "hints_used": 0,  # Resume interviews don't use hints
                            "difficulty": difficulty
                        }
                        
                        print(f"📊 Question data to store: {question_data}")
                        try:
                            result = await db.store_question_response(
                                session["session_id"],
                                question_index,
                                question_data
                            )
                            print(f"✅ Database storage result: {result}")
                            print(f"✅ Stored resume Q&A #{question_index} (score: {score}, difficulty: {difficulty})")
                        except Exception as e:
                            print(f"⚠️ Failed to store resume Q&A: {e}")
                            import traceback
                            traceback.print_exc()
                    else:
                        print(f"⚠️ Cannot store Q&A - Missing session_id or interview_id")
                    
                    # Reset time for next question
                    session["last_question_time"] = current_time
                    
                    print(f"📤 Sending assessment to frontend (score: {score})")
                    await ws.send_text(json.dumps({"type": "assessment", **reply}))
                    
                except Exception as e:
                    print(f"❌ Error in record_audio handler: {e}")
                    import traceback
                    traceback.print_exc()
                    await ws.send_text(json.dumps({
                        "type": "error",
                        "error": f"Recording failed: {str(e)}"
                    }))

            elif mtype == "end":
                # Set flag to stop any ongoing recording
                session["ended"] = True
                
                print(f"\n🏁 END INTERVIEW - Starting comprehensive save")
                print(f"Session ID: {session.get('session_id')}")
                print(f"Interview ID: {session.get('interview_id')}")
                print(f"Mode: {session.get('mode')}")
                print(f"Conversation length: {len(session.get('conversation', []))}")
                print(f"Individual scores: {session.get('individual_scores', [])}")
                
                # Save interview results before ending
                try:
                    if session and "conversation" in session:
                        # Use existing interview_id from session (created during init)
                        interview_id = session.get("interview_id")
                        if not interview_id:
                            # Fallback: create new ID if somehow missing
                            interview_id = str(uuid.uuid4())
                            print(f"⚠️ WARNING: No interview_id in session, creating new one: {interview_id}")
                        
                        end_time = time.time()
                        conversation = session.get("conversation", [])
                        individual_scores = session.get("individual_scores", [])
                        
                        # Save to database if session was tracked
                        if session.get("session_id") and interview_id:
                            print(f"\n💾 SAVING {session.get('mode', 'unknown').upper()} INTERVIEW TO DATABASE...")
                            
                            # Calculate duration
                            duration = int(end_time - session.get("start_time", end_time))
                            print(f"Duration: {duration}s ({duration//60}m {duration%60}s)")
                            
                            # Calculate dynamic scores from tracked data
                            individual_scores = session.get("individual_scores", [])
                            conversation_count = len(session["conversation"])
                            
                            print(f"\n📊 FINAL METRICS CALCULATION:")
                            print(f"  Total Q&A exchanges: {conversation_count}")
                            print(f"  Individual scores collected: {len(individual_scores)}")
                            print(f"  Scores: {individual_scores}")
                            
                            if individual_scores:
                                average_score = round(sum(individual_scores) / len(individual_scores))
                                print(f"  Average score: {sum(individual_scores)}/{len(individual_scores)} = {average_score}")
                            else:
                                average_score = 0
                                print(f"  ⚠️ No scores collected - setting average to 0")
                            
                            # Validate: ensure individual_scores length matches completed_questions
                            completed_questions = conversation_count
                            if len(individual_scores) != completed_questions:
                                print(f"⚠️ MISMATCH: {len(individual_scores)} scores vs {completed_questions} questions")
                                # This is OK if some questions didn't have scores - don't pad
                            
                            print(f"\n📋 FINAL RESUME INTERVIEW METRICS:")
                            print(f"   ✓ Completed questions: {completed_questions}")
                            print(f"   ✓ Current question index: {completed_questions}")
                            print(f"   ✓ Individual scores: {individual_scores}")
                            print(f"   ✓ Average score: {average_score}/100")
                            print(f"   ✓ Duration: {duration}s")
                            
                            # 🔥 ENRICH final_results using LLM
                            print("\n🤖 Enriching final_results with LLM...")
                            print(f"   Conversation entries: {len(conversation)}")
                            print(f"   First entry keys: {list(conversation[0].keys()) if conversation else 'EMPTY'}")
                            
                            # Transform conversation to expected format for enrichment
                            # Session stores conversation as: 
                            #   [{"candidate": "...", "score": X, "evaluation": "...", "next_question": "...", ...}]
                            # Enrichment expects: 
                            #   [{"question": "...", "answer": "...", "evaluation": "...", "score": X}]
                            transformed_conversation = []
                            for entry in conversation:
                                if isinstance(entry, dict):
                                    question_text = entry.get('next_question') or entry.get('content', '')
                                    answer_text = entry.get('candidate') or entry.get('content', '')
                                    eval_text = entry.get('evaluation', '')
                                    score = entry.get('score', 0)
                                    
                                    # Only add if we have meaningful data
                                    if question_text or answer_text:
                                        transformed_conversation.append({
                                            "question": question_text,
                                            "answer": answer_text,
                                            "evaluation": eval_text,
                                            "score": score / 10 if score > 10 else score  # Normalize to 10-scale if needed
                                        })
                            
                            print(f"   Transformed to {len(transformed_conversation)} Q&A rounds")
                            if transformed_conversation:
                                print(f"   First Q&A: Q='{transformed_conversation[0]['question'][:50]}...' A='{transformed_conversation[0]['answer'][:50]}...'")
                            
                            try:
                                enriched_final_results = enrich_resume_interview_results(
                                    conversation=transformed_conversation,
                                    individual_scores=individual_scores,
                                    average_score=average_score,
                                    duration=duration,
                                    resume_text=session.get("resume_text", "")
                                )
                                print("✅ LLM enrichment successful")
                                print(f"   Hire recommendation: {enriched_final_results.get('interview_summary', {}).get('hire_recommendation', 'N/A')}")
                            except Exception as e:
                                print(f"⚠️ LLM enrichment failed: {e}. Using basic results.")
                                import traceback
                                traceback.print_exc()
                                # Provide basic fallback structure
                                enriched_final_results = {
                                    "interview_type": "resume",
                                    "interview_summary": {
                                        "overall_assessment": f"Interview completed with {len(individual_scores)} questions answered",
                                        "hire_recommendation": "borderline" if average_score < 70 else "yes",
                                        "confidence_level": "medium"
                                    },
                                    "evaluation_metadata": {
                                        "evaluation_model": "fallback",
                                        "scoring_method": "basic",
                                        "completion_method": "manually_ended",
                                        "signals_used": ["conversation_length", "scores"]
                                    }
                                }
                            
                            # ✅ Build ONLY the structured final_results JSON (single source of truth)
                            # Merge enriched LLM data with metadata
                            final_results_data = {
                                **enriched_final_results,  # LLM-enriched evaluation
                                # Add metadata not in enrichment
                                "interview_id": interview_id,
                                "timestamp": datetime.now().isoformat(),
                                "conversation": conversation,
                                "resume_id": session.get("resume_id"),
                                "topics": session.get("topics", []),
                                "total_interactions": len(conversation),
                                "individual_scores": individual_scores,
                                "questions_answered": len(individual_scores),
                                "completed_questions": completed_questions,
                                "average_score": average_score,
                                "duration": duration
                            }
                            
                            # ✅ Update evaluation_metadata with correct completion_method
                            if "evaluation_metadata" in final_results_data:
                                final_results_data["evaluation_metadata"]["completion_method"] = "manually_ended"
                            
                            # Complete the interview in database
                            results_data = {
                                "end_time": end_time,
                                "duration": duration,
                                "total_time": duration,
                                "completed_questions": completed_questions,
                                "current_question_index": completed_questions,
                                "average_score": average_score,
                                "individual_scores": individual_scores,
                                "final_results": final_results_data,  # ✅ Structured enriched data
                                "completion_method": final_results_data.get("evaluation_metadata", {}).get("completion_method", "manually_ended")
                            }
                            
                            print(f"\n📦 RESULTS_DATA FOR DATABASE:")
                            print(f"   end_time: {results_data['end_time']} (type: {type(results_data['end_time'])})")
                            print(f"   duration: {results_data['duration']}s")
                            print(f"   average_score: {results_data['average_score']}")
                            print(f"   individual_scores: {results_data['individual_scores']}")
                            print(f"   final_results size: {len(str(results_data['final_results']))} chars")
                            print(f"   final_results keys: {list(results_data['final_results'].keys())}")
                            
                            # Save to database
                            success = await db.complete_interview(session["session_id"], results_data)
                            if success:
                                print("✅ Interview results saved to database successfully")
                                _interviews_cache["data"] = None
                                _interviews_cache["timestamp"] = 0
                                print("🔄 Cache invalidated - Past Interviews will show fresh data")
                            else:
                                print(f"❌ DATABASE SAVE FAILED - db.complete_interview returned False")
                            
                            # Also save to file for backup
                            filename = f"interview_results_{interview_id}.json"
                            results_dir = "interview_results"
                            os.makedirs(results_dir, exist_ok=True)
                            filepath = os.path.join(results_dir, filename)
                            
                            with open(filepath, 'w', encoding='utf-8') as f:
                                json.dump(final_results_data, f, indent=2, ensure_ascii=False)
                            print(f"💾 Backup saved to file: {filepath}")
                            
                            await ws.send_text(json.dumps({
                                "type": "ended",
                                "interview_id": interview_id,
                                "download_url": f"/download_results/{interview_id}"
                            }))
                        else:
                            print(f"\n❌ CANNOT SAVE TO DATABASE - Missing identifiers:")
                            print(f"   session_id: {session.get('session_id')}")
                            print(f"   interview_id: {session.get('interview_id')}")
                            await ws.send_text(json.dumps({"type": "ended"}))
                    else:
                        print("⚠️ No conversation data to save")
                        await ws.send_text(json.dumps({"type": "ended"}))
                except Exception as e:
                    print(f"❌ ERROR SAVING INTERVIEW: {e}")
                    import traceback
                    traceback.print_exc()
                    await ws.send_text(json.dumps({
                        "type": "ended",
                        "error": f"Failed to save results: {str(e)}"
                    }))
                await ws.close()
                break

            else:
                await ws.send_text(json.dumps({
                    "type": "error", "error": f"Unknown message type: {mtype}"
                }))

    except WebSocketDisconnect:
        # Save session on disconnect if it exists
        if session.get("session_id") and session.get("interview_id"):
            try:
                print(f"📊 WebSocket disconnected, saving {session.get('mode', 'unknown')} interview...")
                end_time = time.time()
                duration = int(end_time - session.get("start_time", end_time))
                
                results_data = {
                    "end_time": end_time,
                    "duration": duration,
                    "total_time": duration,
                    "completed_questions": len(session.get("conversation", [])),
                    "average_score": 0,
                    "individual_scores": [],
                    "final_results": {
                        "interview_type": session.get("mode", "unknown"),
                        "conversation": session.get("conversation", []),
                        "total_interactions": len(session.get("conversation", []))
                    },
                    "completion_method": "disconnected"
                }
                
                await db.complete_interview(session["session_id"], results_data)
                print(f"✅ Interview saved on disconnect: {session['session_id']}")
            except Exception as e:
                print(f"❌ Error saving interview on disconnect: {e}")
        return


# -----------------------------
# Technical Interview WebSocket endpoint
# -----------------------------
@app.websocket("/ws/technical")
async def technical_ws_endpoint(ws: WebSocket):
    print("🔌 Technical WebSocket connection attempt")
    await ws.accept()
    print("✅ Technical WebSocket accepted")
    
    # Extract and verify authentication token from query params
    user_id = None
    try:
        # Get token from query parameter
        query_params = dict(ws.query_params)
        token = query_params.get("token")
        print(f"🔑 Token present: {bool(token)}")
        
        if not token:
            await ws.send_text(json.dumps({
                "type": "error",
                "error": "Authentication required. Please login first."
            }))
            await ws.close(code=1008, reason="Authentication required")
            return
        
        # Verify JWT token
        if SUPABASE_JWT_SECRET and SUPABASE_JWT_SECRET != "your-jwt-secret-from-supabase-dashboard-settings-api":
            print("🔐 Verifying JWT token with secret...")
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            # Fallback: decode without verification (development only)
            print("⚠️ WARNING: JWT verification disabled - using fallback mode (technical)")
            payload = jwt.decode(token, options={"verify_signature": False})
        
        user_id = payload.get("sub")
        if not user_id:
            raise Exception("Invalid token: missing user ID")
        
        print(f"✅ Technical WebSocket authenticated for user: {user_id}")
        
    except PyJWTError as e:
        print(f"❌ JWT Error in technical WebSocket: {e}")
        await ws.send_text(json.dumps({
            "type": "error",
            "error": f"Invalid authentication token: {str(e)}"
        }))
        await ws.close(code=1008, reason="Invalid token")
        return
    except Exception as e:
        print(f"❌ Authentication error in technical WebSocket: {e}")
        import traceback
        traceback.print_exc()
        await ws.send_text(json.dumps({
            "type": "error",
            "error": f"Authentication failed: {str(e)}"
        }))
        await ws.close(code=1008, reason="Authentication failed")
        return
    
    session_id = None
    session = None
    
    try:
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                await ws.send_text(json.dumps({
                    "type": "error", "error": "Invalid JSON message"
                }))
                continue

            mtype = msg.get("type")

            if mtype == "init_technical":
                topics = msg.get("topics", [])
                print(f"📝 Received init_technical with topics: {topics}")
                if not topics:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No topics selected"
                    }))
                    continue
                
                # Create technical interview session with user_id
                print(f"🏗️ Creating TechnicalSession for user {user_id}")
                session = TechnicalSession(topics, user_id)
                session_id = session.session_id
                technical_sessions[session_id] = session
                print(f"✅ TechnicalSession created: {session_id}")
                
                # Send immediate acknowledgment
                await ws.send_text(json.dumps({
                    "type": "initializing",
                    "message": "Preparing your interview questions..."
                }))
                
                # Generate questions asynchronously
                print(f"📝 Starting async question generation...")
                await session.generate_questions_async()
                
                # Send first question
                current_question = session.get_current_question()
                print(f"📤 Sending first question: {current_question['question'][:50] if current_question else 'None'}...")
                if current_question:
                    await ws.send_text(json.dumps({
                        "type": "question",
                        "next_question": current_question['question'],
                        "difficulty": current_question['difficulty'],
                        "topics": current_question['topics']
                    }))
                else:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No questions available for selected topics"
                    }))

            elif mtype == "submit_code":
                if not session:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No active session"
                    }))
                    continue
                
                # Check if this question was already submitted
                if session.question_submitted:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "This question has already been submitted. Please wait for the next question."
                    }))
                    continue
                
                # Immediately acknowledge submission and stop any ongoing speech
                await ws.send_text(json.dumps({
                    "type": "stop_speech",
                    "message": "Code submitted. Processing..."
                }))
                
                code = msg.get("code", "")
                language = msg.get("language", "python")
                time_spent = msg.get("time_spent", 0)
                hints_used = msg.get("hints_used", 0)
                
                # Mark this question as submitted
                session.question_submitted = True
                
                # Store code submission
                session.add_code_submission(code, language)
                
                print(f"Evaluating submission for question {session.current_question_index + 1}")
                
                # Evaluate the code submission with LLM
                score = await llm_evaluate_code_submission(session, code, language, time_spent, hints_used)
                session.add_score(score)
                
                print(f"Question {session.current_question_index + 1} scored: {score}/100")
                
                # Extract question-specific feedback from LLM evaluation
                question_specific_feedback = ""
                if session.final_evaluation and isinstance(session.final_evaluation, dict):
                    # Use the detailed feedback from the LLM for this specific question
                    question_specific_feedback = session.final_evaluation.get('feedback', '')
                    if not question_specific_feedback:
                        # Fallback to constructing from evaluation details
                        correctness = session.final_evaluation.get('technical_correctness', 'unknown')
                        reason = session.final_evaluation.get('correctness_reason', '')
                        improvements = session.final_evaluation.get('areas_for_improvement', [])
                        
                        feedback_parts = [f"Score: {score}/100"]
                        if reason:
                            feedback_parts.append(reason)
                        if improvements:
                            feedback_parts.append("Areas for improvement: " + ", ".join(improvements[:2]))
                        question_specific_feedback = " ".join(feedback_parts)
                else:
                    question_specific_feedback = f"Score: {score}/100"
                
                # Send feedback to user
                feedback_msg = f"Question {session.current_question_index + 1} completed! {question_specific_feedback}"
                
                # Store question response in database with question-specific feedback and language
                await session.store_question_response_in_db(
                    session.current_question_index, 
                    msg.get("code", ""), 
                    score, 
                    question_specific_feedback,  # Use the specific feedback, not generic message
                    language  # Include the language used for this question
                )
                
                await ws.send_text(json.dumps({
                    "type": "code_feedback",
                    "code_feedback": feedback_msg,
                    "score": score,
                    "question_number": session.current_question_index + 1
                }))
                
                # Check if interview is complete
                print(f"🔍 Checking if interview complete:")
                print(f"   Current index: {session.current_question_index}")
                print(f"   Total questions: {len(session.questions)}")
                print(f"   Condition: {session.current_question_index} >= {len(session.questions) - 1} = {session.current_question_index >= len(session.questions) - 1}")
                
                if session.current_question_index >= len(session.questions) - 1:
                    print("🎉 INTERVIEW SHOULD BE COMPLETE - Starting completion process")
                    
                    # 🔥 ENRICH final_results using LLM for technical interview
                    print("\n🤖 Enriching technical interview final_results with LLM...")
                    try:
                        enriched_final_results = enrich_technical_interview_results(
                            questions_data=session.questions,
                            scores=session.scores,
                            average_score=session.get_final_score(),
                            code_submissions=session.code_submissions,
                            voice_responses=session.voice_responses,
                            duration=int(time.time() - session.start_time),
                            topics=session.topics
                        )
                        print("✅ Technical LLM enrichment successful")
                        print(f"   Hire recommendation: {enriched_final_results.get('interview_summary', {}).get('hire_recommendation', 'N/A')}")
                        print(f"   Problem solving quality: {enriched_final_results.get('interview_summary', {}).get('problem_solving_quality', 'N/A')}")
                    except Exception as e:
                        print(f"⚠️ Technical LLM enrichment failed: {e}. Using basic results.")
                        enriched_final_results = {}
                    
                    # ✅ Build ONLY the structured final_results JSON (single source of truth)
                    completed_count = session.current_question_index + 1
                    
                    # Merge enriched LLM data with metadata
                    final_results = {
                        **enriched_final_results,  # LLM-enriched evaluation
                        # Add metadata not in enrichment
                        "session_id": session_id,
                        "topics": session.topics,
                        "total_questions": len(session.questions),
                        "completed_questions": completed_count,
                        "average_score": session.get_final_score(),
                        "individual_scores": session.scores,
                        "total_time": time.time() - session.start_time,
                        "voice_responses": session.voice_responses,
                        "code_submissions": session.code_submissions,
                        "questions_data": session.questions[:completed_count],  # Only completed
                        "final_evaluation": session.final_evaluation
                    }
                    
                    # ✅ Update evaluation_metadata with correct completion_method
                    if "evaluation_metadata" in final_results:
                        final_results["evaluation_metadata"]["completion_method"] = "automatic"
                    
                    # Store completion in database
                    print(f"\n📤 Storing automatic completion in database...")
                    print(f"🔍 final_results keys: {list(final_results.keys())}")
                    print(f"🔍 final_results has enrichment: {bool(final_results.get('interview_summary'))}")
                    print(f"🔍 Hire recommendation: {final_results.get('interview_summary', {}).get('hire_recommendation', 'N/A')}")
                    await session.complete_interview_in_db(final_results)
                    
                    # Save results to file (backup)
                    results_file = f"interview_results/interview_results_{session_id}.json"
                    os.makedirs("interview_results", exist_ok=True)
                    
                    with open(results_file, 'w') as f:
                        json.dump(final_results, f, indent=2, default=str)
                    results_file = f"interview_results/interview_results_{session_id}.json"
                    os.makedirs("interview_results", exist_ok=True)
                    
                    with open(results_file, 'w') as f:
                        json.dump(final_results, f, indent=2, default=str)
                    
                    await ws.send_text(json.dumps({
                        "type": "interview_complete",
                        "final_feedback": f"Technical interview completed! Final score: {session.get_final_score():.1f}/100",
                        "results": final_results,
                        "download_url": f"/download_results/{session_id}"
                    }))
                else:
                    # Move to next question
                    print(f"Moving to next question. Current index: {session.current_question_index}, Total questions: {len(session.questions)}")
                    next_question_data = session.next_question()
                    print(f"Next question data available: {next_question_data is not None}")
                    
                    if next_question_data:
                        print(f"Sending next question: {next_question_data.get('question', 'Unknown')[:50]}...")
                        
                        # Update database progress
                        await session.update_progress_in_db()
                        
                        await ws.send_text(json.dumps({
                            "type": "question_complete",
                            "score": score,
                            "question_number": session.current_question_index,  # New question number
                            "next_question": next_question_data['question'],
                            "difficulty": next_question_data['difficulty'],
                            "topics": next_question_data['topics'],
                            "total_questions": len(session.questions),
                            "remaining_questions": len(session.questions) - session.current_question_index
                        }))
                        print(f"✅ Successfully sent next question {session.current_question_index + 1}/{len(session.questions)}")
                    else:
                        print("❌ No next question available - this shouldn't happen!")
                        # This case should not happen with our logic, but handle it gracefully
                        print(f"Debug: current_index={session.current_question_index}, total_questions={len(session.questions)}")
                        
                        # Force complete the interview
                        final_results = {
                            "session_id": session_id,
                            "topics": session.topics,
                            "total_questions": len(session.questions),
                            "completed_questions": len(session.scores),
                            "average_score": session.get_final_score(),
                            "individual_scores": session.scores,
                            "total_time": time.time() - session.start_time,
                            "interview_ended_manually": False,
                            "error": "No next question available"
                        }
                        
                        await session.complete_interview_in_db(final_results)
                        
                        await ws.send_text(json.dumps({
                            "type": "interview_complete",
                            "final_feedback": f"Interview ended unexpectedly. Score: {session.get_final_score():.1f}/100",
                            "results": final_results
                        }))

            elif mtype == "voice_approach":
                if not session:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No active session"
                    }))
                    continue
                
                transcript = msg.get("transcript", "")
                if transcript:
                    # Store voice response for approach discussion
                    session.add_voice_response(transcript, "approach")
                    session.approach_discussed = True
                    
                    # Analyze approach quality
                    approach_feedback = await analyze_approach_discussion(session, transcript)
                    
                    await ws.send_text(json.dumps({
                        "type": "approach_feedback",
                        "feedback": approach_feedback,
                        "approach_discussed": True
                    }))

            elif mtype == "record_audio":
                if not session:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No active session"
                    }))
                    continue
                
                await ws.send_text(json.dumps({"type": "listening", "message": "Listening for your approach..."}))
                try:
                    filename = f"technical_approach_{session.session_id}_{len(session.voice_responses)}.wav"
                    recorded_file, heard_speech = record_with_vad(filename)
                    
                    if not heard_speech:
                        await ws.send_text(json.dumps({
                            "type": "no_speech",
                            "message": "No speech detected. Please speak louder or describe your approach."
                        }))
                        continue
                    
                    transcript = transcribe(recorded_file)
                    try:
                        os.remove(recorded_file)
                    except Exception:
                        pass
                    
                    if not transcript_is_valid(transcript):
                        await ws.send_text(json.dumps({
                            "type": "invalid_transcript",
                            "message": "Could not understand. Please repeat your approach more clearly.",
                            "transcript": transcript
                        }))
                        continue
                    
                    # Store and analyze approach
                    session.add_voice_response(transcript, "approach")
                    session.approach_discussed = True
                    
                    approach_feedback = await analyze_approach_discussion(session, transcript)
                    
                    await ws.send_text(json.dumps({
                        "type": "approach_analyzed",
                        "transcript": transcript,
                        "feedback": approach_feedback,
                        "approach_discussed": True
                    }))
                    
                except Exception as e:
                    await ws.send_text(json.dumps({
                        "type": "error",
                        "error": f"Recording failed: {str(e)}"
                    }))

            elif mtype == "request_hint":
                if not session:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No active session"
                    }))
                    continue
                
                current_question_data = session.get_current_question()
                code = msg.get("code", "")
                language = msg.get("language", "python")
                
                # Generate contextual hint using LLM
                hint = await generate_smart_hint(session, current_question_data, code, language)
                session.hints_used += 1
                
                await ws.send_text(json.dumps({
                    "type": "hint",
                    "hint": hint,
                    "hints_used": session.hints_used
                }))

            elif mtype == "stop_recording":
                # Handle stopping voice recording
                await ws.send_text(json.dumps({
                    "type": "recording_stopped",
                    "message": "Voice recording stopped"
                }))

            elif mtype == "end_interview":
                print("🔴 User manually ended interview")
                
                # Immediately stop any ongoing speech and acknowledge end request
                await ws.send_text(json.dumps({
                    "type": "stop_speech",
                    "message": "Interview ending..."
                }))
                
                if not session:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No active session"
                    }))
                    continue
                
                # Calculate current time and duration
                current_time = time.time()
                total_duration = current_time - session.start_time
                
                print(f"📊 Manual interview completion:")
                print(f"   Start time: {session.start_time}")
                print(f"   End time: {current_time}")
                print(f"   Duration: {total_duration:.1f} seconds")
                print(f"   Questions completed: {len(session.scores)}")
                print(f"   Current question index: {session.current_question_index}")
                
                # 🔥 ENRICH final_results using LLM for manually ended technical interview
                print("\n🤖 Enriching manually ended technical interview with LLM...")
                try:
                    enriched_final_results = enrich_technical_interview_results(
                        questions_data=session.questions[:len(session.scores)],  # Only completed questions
                        scores=session.scores,
                        average_score=session.get_final_score(),
                        code_submissions=session.code_submissions,
                        voice_responses=session.voice_responses,
                        duration=int(total_duration),
                        topics=session.topics
                    )
                    print("✅ Manual end technical LLM enrichment successful")
                    print(f"   Hire recommendation: {enriched_final_results.get('interview_summary', {}).get('hire_recommendation', 'N/A')}")
                except Exception as e:
                    print(f"⚠️ Manual end technical LLM enrichment failed: {e}")
                    enriched_final_results = {}
                
                # ✅ Build ONLY the structured final_results JSON (single source of truth)
                completed_count = len(session.scores)
                
                # Merge enriched LLM data with metadata
                final_results = {
                    **enriched_final_results,  # LLM-enriched evaluation
                    # Add metadata not in enrichment
                    "session_id": session_id,
                    "topics": session.topics,
                    "total_questions": len(session.questions),
                    "completed_questions": completed_count,
                    "average_score": session.get_final_score(),
                    "individual_scores": session.scores,
                    "total_time": total_duration,
                    "voice_responses": session.voice_responses,
                    "code_submissions": session.code_submissions,
                    "questions_data": session.questions[:completed_count],  # Only completed
                    "final_evaluation": session.final_evaluation,
                    "end_time": current_time
                }
                
                # ✅ Update evaluation_metadata with correct completion_method
                if "evaluation_metadata" in final_results:
                    final_results["evaluation_metadata"]["completion_method"] = "manually_ended"
                
                print("📤 Storing manual completion in database...")
                print(f"🔍 Session ID: {session_id}")
                print(f"🔍 Session object exists: {session is not None}")
                print(f"🔍 Database module loaded: {'db' in globals()}")
                print(f"🔍 final_results keys: {list(final_results.keys())}")
                print(f"🔍 final_results has enrichment: {bool(final_results.get('interview_summary'))}")
                print(f"🔍 Hire recommendation: {final_results.get('interview_summary', {}).get('hire_recommendation', 'N/A')}")
                
                # Store completion in database
                success = await session.complete_interview_in_db(final_results)
                print(f"🔍 Database completion result: {success}")
                
                # Save results to file (backup)
                results_file = f"interview_results/interview_results_{session_id}.json"
                os.makedirs("interview_results", exist_ok=True)
                
                with open(results_file, 'w') as f:
                    json.dump(final_results, f, indent=2, default=str)
                
                await ws.send_text(json.dumps({
                    "type": "interview_complete",
                    "final_feedback": f"Interview ended manually. Final score: {session.get_final_score():.1f}/100 ({len(session.scores)}/{len(session.questions)} questions completed)",
                    "results": final_results,
                    "download_url": f"/download_results/{session_id}"
                }))
                
                print("✅ Manual interview completion processed")

            else:
                await ws.send_text(json.dumps({
                    "type": "error", "error": f"Unknown message type: {mtype}"
                }))

    except WebSocketDisconnect:
        if session_id and session_id in technical_sessions:
            del technical_sessions[session_id]
        return


# -----------------------------
# Technical Interview Helper Functions - Enhanced with LLM
# -----------------------------
async def llm_evaluate_code_submission(session: TechnicalSession, code: str, language: str, time_spent: int, hints_used: int) -> int:
    """
    Evaluate a code submission using LLM with comprehensive criteria
    """
    print(f"🔍 Starting evaluation for question {session.current_question_index + 1}")
    print(f"🔍 Code length: {len(code)}, Language: {language}, Time: {time_spent/1000:.1f}s, Hints: {hints_used}")
    
    # CRITICAL: Detect if code is just boilerplate/template (unchanged)
    code_stripped = code.strip()
    is_boilerplate = False
    
    # Check for common boilerplate patterns
    boilerplate_indicators = [
        "# Write your solution here",
        "// Write your solution here",
        "Your code here",
        "pass\n\nif __name__",  # Python with just pass
        "function solution() {\n    // Your code here\n}",  # JS unchanged
        "public void solution() {\n        \n    }",  # Java empty
        "void solution() {\n        \n    }"  # C++ empty
    ]
    
    # Check if code is essentially unchanged from template
    for indicator in boilerplate_indicators:
        if indicator in code:
            is_boilerplate = True
            print(f"⚠️ BOILERPLATE DETECTED: Found '{indicator[:30]}...'")
            break
    
    # Also check if code is too short (less than 5 meaningful lines)
    meaningful_lines = [line for line in code_stripped.split('\n') 
                       if line.strip() and not line.strip().startswith('#') 
                       and not line.strip().startswith('//') 
                       and line.strip() != 'pass']
    
    if len(meaningful_lines) < 5:
        is_boilerplate = True
        print(f"⚠️ BOILERPLATE DETECTED: Only {len(meaningful_lines)} meaningful lines")
    
    if is_boilerplate:
        print("❌ Code is unchanged boilerplate - returning score 0")
        # Set feedback for boilerplate submissions
        session.final_evaluation = {
            "technical_correctness": "no_attempt",
            "feedback": "No solution submitted. The code is unchanged from the template. Please implement a solution to the problem.",
            "correctness_reason": "Code contains only boilerplate/template without any implementation",
            "edge_cases_handled": [],
            "areas_for_improvement": ["Implement the solution", "Follow the problem requirements"],
            "final_score": 0,
            "base_score": 0,
            "deductions": 0
        }
        return 0
    
    if not client:
        print("❌ Groq client not available, using fallback evaluation")
        return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)
    
    current_question = session.get_current_question()
    print(f"🎯 Evaluating against question: {current_question['question'][:50]}...")
    
    # Prepare evaluation context
    evaluation_prompt = f"""
You are a technical interviewer. Evaluate this code submission and respond with ONLY valid JSON (no markdown, no extra text).

Question: {current_question['question']}
Candidate's Code ({language}):
{code}

Interview Context:
- Time spent: {time_spent/1000:.1f}s
- Hints used: {hints_used}
- Discussion turns: {session.discussion_turns}
- Clarification questions: {session.clarification_questions}
- Approach discussed: {session.approach_discussed}

Evaluation Criteria:
You must classify the technical correctness into ONE of these three levels:

1. "fully_correct": Logic is sound, handles edge cases, implementation is correct
2. "mostly_correct": Core logic correct but has minor bugs, syntax issues, or missed 1-2 edge cases
3. "incorrect": Wrong approach, fundamentally broken logic, or doesn't solve the problem

DO NOT assign a numerical score. Only evaluate correctness level and provide feedback.

Respond exactly like this:
{{
    "technical_correctness": "fully_correct",
    "feedback": "Brief overall assessment of the solution",
    "correctness_reason": "Why this correctness level was assigned",
    "edge_cases_handled": ["edge case 1", "edge case 2"],
    "areas_for_improvement": ["improvement 1", "improvement 2"]
}}
"""

    print(f"📤 Sending evaluation prompt to LLM...")

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a technical interviewer. Always respond with valid JSON only. Never use markdown formatting."},
                {"role": "user", "content": evaluation_prompt}
            ],
            temperature=0.2,
            max_tokens=400
        )
        
        response_content = response.choices[0].message.content
        print(f"📥 Evaluation Response Length: {len(response_content) if response_content else 0}")
        print(f"📥 Evaluation Response Preview: {response_content[:100] if response_content else 'EMPTY'}...")
        
        if not response_content or response_content.strip() == "":
            print("❌ Empty response from LLM")
            return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)
        
        print(f"🔍 Raw LLM evaluation response: {response_content}")  # Full debug logging
        
        import json
        
        # Multi-layer JSON parsing strategy
        evaluation = None
        
        # Layer 1: Direct parsing
        try:
            evaluation = json.loads(response_content.strip())
        except json.JSONDecodeError:
            # Layer 2: Extract and repair JSON
            try:
                extracted = extract_json_from_response(response_content)
                repaired = repair_json_string(extracted)
                evaluation = json.loads(repaired)
            except json.JSONDecodeError:
                # Layer 3: Manual cleanup and retry
                try:
                    cleaned = response_content.strip()
                    # Remove any text before first {
                    if '{' in cleaned:
                        cleaned = cleaned[cleaned.find('{'):]
                    # Remove any text after last }
                    if '}' in cleaned:
                        cleaned = cleaned[:cleaned.rfind('}')+1]
                    # Remove markdown and repair
                    cleaned = repair_json_string(cleaned)
                    evaluation = json.loads(cleaned)
                except json.JSONDecodeError as final_error:
                    print(f"JSON decode error: {final_error}")
                    print(f"Raw response: {response_content}")
                    return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)
        
        if evaluation:
            # Extract correctness level from LLM
            technical_correctness = evaluation.get("technical_correctness", "incorrect")
            
            # Determine base score from correctness level
            # ✅ Never assign 0 to correct/mostly_correct solutions
            base_score_map = {
                "fully_correct": 100,
                "mostly_correct": 75,  # Minimum 75 for partially correct
                "partially_correct": 60,  # Minimum 60 for attempts with some correctness
                "incorrect": 30  # Even incorrect attempts get 30 for trying
            }
            base_score = base_score_map.get(technical_correctness, 60)
            
            print(f"🎯 Technical Correctness: {technical_correctness} → Base Score: {base_score}")
            
            # Apply deterministic deductions
            deductions = 0
            
            # Hints penalty: -10 per hint
            hints_penalty = hints_used * 10
            deductions += hints_penalty
            if hints_penalty > 0:
                print(f"  ⚠️ Hints penalty: -{hints_penalty} ({hints_used} hints × 10)")
            
            # Discussion turns penalty: -5 per turn (debugging/edge case prompts)
            # Only penalize if solution is not fully correct (indicates struggling)
            if technical_correctness != "fully_correct" and session.discussion_turns > 0:
                discussion_penalty = session.discussion_turns * 5
                deductions += discussion_penalty
                print(f"  ⚠️ Discussion penalty: -{discussion_penalty} ({session.discussion_turns} turns × 5)")
            
            # Clarification penalty: -5 per clarification (only if excessive)
            # Some clarifications are good, but >2 suggests confusion
            if session.clarification_questions > 2:
                clarification_penalty = (session.clarification_questions - 2) * 5
                deductions += clarification_penalty
                print(f"  ⚠️ Clarification penalty: -{clarification_penalty} ({session.clarification_questions - 2} excessive × 5)")
            
            # Calculate final score
            # ✅ Ensure minimum score based on correctness level
            min_score = 60 if technical_correctness in ["fully_correct", "mostly_correct"] else 30
            final_score = max(min_score, min(100, base_score - deductions))
            
            print(f"📊 Score Calculation:")
            print(f"   Base ({technical_correctness}): {base_score}")
            print(f"   Total Deductions: -{deductions}")
            print(f"   Final Score: {final_score}/100")
            
            # Store detailed evaluation in session for results
            evaluation["final_score"] = final_score
            evaluation["base_score"] = base_score
            evaluation["deductions"] = deductions
            session.final_evaluation = evaluation
            
            return int(final_score)
            
    except Exception as e:
        print(f"Error in LLM evaluation: {e}")
        # Fallback to basic evaluation
        return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)


def evaluate_code_submission_fallback(session: TechnicalSession, code: str, language: str, time_spent: int, hints_used: int) -> int:
    """
    Fallback evaluation method if LLM fails - uses heuristic correctness detection
    """
    print("⚠️ Using fallback evaluation (LLM unavailable)")
    
    # Check for boilerplate first
    code_stripped = code.strip()
    boilerplate_indicators = [
        "# Write your solution here",
        "// Write your solution here",
        "Your code here",
        "pass\n\nif __name__"
    ]
    
    for indicator in boilerplate_indicators:
        if indicator in code:
            print(f"❌ Boilerplate detected in fallback: {indicator[:30]}...")
            return 0
    
    # Heuristic correctness detection based on code quality
    code_lower = code.lower()
    has_function = 'def ' in code or 'function ' in code or 'class ' in code
    has_logic = any(keyword in code_lower for keyword in ['if', 'else', 'for', 'while', 'return'])
    has_structure = len(code.strip()) > 50
    
    # Estimate correctness level
    if has_function and has_logic and has_structure:
        # Assume mostly correct if code looks complete
        base_score = 80
        print("  📊 Heuristic: mostly_correct (has function, logic, structure)")
    elif has_function or (has_logic and has_structure):
        # Partial implementation
        base_score = 60
        print("  📊 Heuristic: partially_correct (incomplete)")
    else:
        # Minimal/incorrect code
        base_score = 40
        print("  📊 Heuristic: incorrect (insufficient code)")
    
    # Apply deterministic deductions (same as LLM path)
    deductions = 0
    
    # Hints penalty: -10 per hint
    hints_penalty = hints_used * 10
    deductions += hints_penalty
    if hints_penalty > 0:
        print(f"  ⚠️ Hints penalty: -{hints_penalty}")
    
    # Discussion penalty: -5 per turn
    if session.discussion_turns > 0:
        discussion_penalty = session.discussion_turns * 5
        deductions += discussion_penalty
        print(f"  ⚠️ Discussion penalty: -{discussion_penalty}")
    
    # Clarification penalty: -5 per excessive clarification (>2)
    if session.clarification_questions > 2:
        clarification_penalty = (session.clarification_questions - 2) * 5
        deductions += clarification_penalty
        print(f"  ⚠️ Clarification penalty: -{clarification_penalty}")
    
    final_score = max(0, min(100, base_score - deductions))
    print(f"  📊 Fallback Final Score: {final_score}/100")
    
    return final_score


async def analyze_approach_discussion(session: TechnicalSession, transcript: str) -> str:
    """
    Analyze the quality of approach discussion using LLM
    """
    if not client:
        print("Groq client not available, using fallback approach analysis")
        return "Good start on explaining your approach. Consider discussing time complexity and edge cases for a more complete analysis."
    
    current_question = session.get_current_question()
    
    analysis_prompt = f"""
Analyze the candidate's approach discussion for this technical interview question.

Question: {current_question['question']}
Topics: {current_question['topics']}

Candidate's Approach Discussion:
"{transcript}"

Evaluate:
1. Problem understanding demonstrated
2. Approach clarity and correctness
3. Consideration of edge cases
4. Time/space complexity awareness
5. Alternative solutions mentioned

Provide constructive reply like an interviewer (2-3 sentences) focusing on strengths and areas for improvement.
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": analysis_prompt}],
            temperature=0.4,
            max_tokens=300
        )
        
        response_content = response.choices[0].message.content
        if not response_content or response_content.strip() == "":
            print("Empty response from LLM for approach analysis")
            return "Good start on explaining your approach. Consider discussing time complexity and edge cases for a more complete analysis."
        
        return response_content.strip()
    except Exception as e:
        print(f"Error in approach analysis: {e}")
        return "Good start on explaining your approach. Consider discussing time complexity and edge cases for a more complete analysis."


async def generate_smart_hint(session: TechnicalSession, question_data: dict, current_code: str, language: str) -> str:
    """
    Generate contextual hints using LLM based on current progress
    """
    if not client:
        print("Groq client not available, using fallback hint generation")
        return generate_hint_fallback(question_data, current_code, language, session.hints_used)
    hint_prompt = f"""
You are helping a candidate in a technical interview. They've asked for a hint.

Question: {question_data['question']}
Topics: {question_data['topics']}
Hints used so far: {session.hints_used}

Current Code ({language}):
{current_code}

Previous hints given: {session.hints_used}
Approach discussed: {session.approach_discussed}

Provide a helpful but not overly revealing hint. The hint should:
- Guide them toward the right direction without giving away the solution
- Be appropriate for their current progress level
- Become more specific if they've used multiple hints already
- Encourage them to think about the approach if they haven't discussed it

Keep the hint to 1-2 sentences.
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": hint_prompt}],
            temperature=0.6,
            max_tokens=200
        )
        
        response_content = response.choices[0].message.content
        if not response_content or response_content.strip() == "":
            print("Empty response from LLM for hint generation")
            return generate_hint_fallback(question_data, current_code, language, session.hints_used)
        
        return response_content.strip()
    except Exception as e:
        print(f"Error generating hint: {e}")
        return generate_hint_fallback(question_data, current_code, language, session.hints_used)


def generate_hint_fallback(question_data: dict, current_code: str, language: str, hints_used: int) -> str:
    """
    Fallback hint generation if LLM fails
    """
    topics = question_data.get('topics', [])
    hints = question_data.get('hints', [])
    
    # Use pre-generated hints if available
    if hints and hints_used <= len(hints):
        return hints[min(hints_used, len(hints) - 1)]
    
    # Generic progressive hints
    if hints_used == 1:
        return "Think about what data structure would be most efficient for this problem."
    elif hints_used == 2:
        return "Consider the time complexity of your current approach. Can it be optimized?"
    elif hints_used >= 3:
        return "Focus on the core algorithm. Try writing pseudocode first, then implement step by step."
    
    return "Break the problem down into smaller steps and tackle each one systematically."


# ---------------
# Uvicorn helper
# ---------------
def get_app():
    return app
