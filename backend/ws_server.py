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

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

# Import all functions from existing modules
from utils import TOPIC_OPTIONS, build_interviewer_prompt, record_with_vad
from interview import transcript_is_valid, transcribe, interviewer_reply, INTERVIEWER_PROMPT
from interview_with_resume import read_resume
from groq import Groq

# Import database operations
from database import db

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
        fallback = {
            "question": f"Write a function to solve a {difficulty} problem related to {', '.join(topics)}. Explain your approach first.",
            "difficulty": difficulty,
            "topics": topics,
            "hints": ["Think about the data structures you need", "Consider the time complexity", "Don't forget edge cases"],
            "test_cases": [{"input": "test input", "output": "expected output", "explanation": "basic test case"}],
            "evaluation_criteria": ["Problem approach", "Code implementation", "Edge cases"]
        }
        print(f"📝 Fallback question: {fallback['question'][:50]}...")
        return fallback
        
    topics_str = ", ".join(topics)
    
    prompt = f"""
You are a senior technical interviewer. Generate a coding interview question as a JSON object.

Topics: {topics_str}
Difficulty: {difficulty}

Format your response exactly like this (no extra text, no markdown):

{{
    "question": "Write a clear problem description with examples",
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
            max_tokens=600
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
        print(f"Error generating question: {e}")
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
    def __init__(self, topics: List[str]):
        print(f"🏁 Initializing TechnicalSession with topics: {topics}")
        self.topics = topics
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
        
        print(f"🔧 Client status: {'✅ Available' if client else '❌ Not available'}")
        
        # Generate questions using LLM based on selected topics
        difficulties = ["easy", "medium", "medium", "hard"]  # Progressive difficulty
        print(f"📝 Starting to generate {len(difficulties)} questions...")
        
        for i, difficulty in enumerate(difficulties):
            if i < 4:  # Generate up to 4 questions
                print(f"📝 Generating question {i+1}/{len(difficulties)} (difficulty: {difficulty})")
                try:
                    question = generate_technical_question(topics, difficulty)
                    question['id'] = i + 1
                    self.questions.append(question)
                    print(f"✅ Question {i+1} generated successfully: {question.get('question', 'Unknown')[:70]}...")
                except Exception as e:
                    print(f"❌ Failed to generate question {i+1}: {e}")
                    # Add fallback question
                    fallback_question = {
                        "id": i + 1,
                        "question": f"Write a function to solve a {difficulty} problem related to {', '.join(topics)}. Explain your approach.",
                        "difficulty": difficulty,
                        "topics": topics,
                        "hints": ["Think step by step", "Consider edge cases"],
                        "test_cases": [{"input": "example", "output": "result", "explanation": "test"}],
                        "evaluation_criteria": ["Correctness", "Approach"]
                    }
                    self.questions.append(fallback_question)
                    print(f"🔄 Added fallback question {i+1}")
        
        print(f"🎯 Session initialization complete. Generated {len(self.questions)} questions")
        
        # Initialize database record asynchronously
        asyncio.create_task(self._initialize_database_record())
    
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
            
            self.interview_id = await db.create_interview_session(session_data)
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
    
    async def store_question_response_in_db(self, question_index: int, user_response: str, score: int, feedback: str):
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
                    "difficulty": question.get("difficulty", "medium")
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

            # If this is a manual end, force completion_method
            completion_method = final_results.get("completion_status") or final_results.get("completion_method")
            if completion_method != "manually_ended" and final_results.get("interview_ended_manually"):
                completion_method = "manually_ended"

            results_data = {
                "end_time": iso_end_time,
                "start_time": iso_start_time,
                "duration": int(self.end_time - self.start_time) if self.start_time else 0,
                "total_time": int(self.end_time - self.start_time) if self.start_time else 0,
                "completed_questions": len([s for s in self.scores if s is not None]),
                "average_score": float(self.get_final_score()),
                "individual_scores": normalized_scores if normalized_scores else [float(s) for s in self.scores],
                "final_results": final_results,
                "completion_method": completion_method or "automatic",
                **final_results  # Include all other result data
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
# App setup
# -----------------------------
app = FastAPI(title="Interview WebSocket Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://codesage-five.vercel.app/", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """Get all interview records from database"""
    try:
        interviews = await db.get_all_interviews(limit)
        return {"interviews": interviews, "count": len(interviews)}
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


# -----------------------------
# WebSocket endpoint
# -----------------------------
@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()

    session = {
        "prompt": None,
        "conversation": [],
        "session_id": None,
        "interview_id": None,
        "start_time": None,
        "mode": None
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
                    session["mode"] = mode
                    session["resume_id"] = resume_id
                    
                    # Create interview session in database
                    session_data = {
                        "session_id": session_id,
                        "interview_type": "resume",
                        "topics": ["Resume-Based"],
                        "start_time": start_time,
                        "total_questions": 0  # Will be determined dynamically
                    }
                    interview_id = await db.create_interview_session(session_data)
                    session["interview_id"] = interview_id
                    print(f"✅ Resume interview session created: {session_id} (DB ID: {interview_id})")
                    
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
Always reply in JSON:
{
  "evaluation": "Brief feedback on the candidate's last response.",
  "next_question": "Your next question for the candidate.",
  "hint": "Optional hint if asked.",
  "final_feedback": "Only include this at the end."
}

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
                candidate = msg.get("text", "").strip()
                if not candidate:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Empty answer text"
                    }))
                    continue

                # Validate transcript
                if not transcript_is_valid(candidate):
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Invalid transcript. Please speak more clearly."
                    }))
                    continue

                reply = interviewer_reply(candidate, session["conversation"])
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
                code = msg.get("code", "").strip()
                if not code:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "Empty code submission"
                    }))
                    continue

                # Process code submission like a regular answer
                candidate_message = f"[Code Submission]\n{code}"
                reply = interviewer_reply(candidate_message, session["conversation"])
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
                    session["conversation"].append({
                        "candidate": candidate,
                        **reply
                    })
                    
                    print(f"📤 Sending assessment to frontend")
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
                
                # Save interview results before ending
                try:
                    if session and "conversation" in session:
                        interview_id = str(uuid.uuid4())
                        import datetime
                        end_time = time.time()
                        
                        interview_data = {
                            "interview_id": interview_id,
                            "timestamp": datetime.datetime.now().isoformat(),
                            "interview_type": session.get("mode", "unknown"),
                            "conversation": session["conversation"],
                            "resume_id": session.get("resume_id"),
                            "topics": session.get("topics", []),
                            "total_interactions": len(session["conversation"])
                        }
                        
                        # Save to database if session was tracked
                        if session.get("session_id") and session.get("interview_id"):
                            print(f"📊 Saving {session.get('mode', 'unknown')} interview to database...")
                            
                            # Calculate duration
                            duration = int(end_time - session.get("start_time", end_time))
                            
                            # Complete the interview in database
                            results_data = {
                                "end_time": end_time,
                                "duration": duration,
                                "total_time": duration,
                                "completed_questions": len(session["conversation"]),
                                "average_score": 0,  # No scoring for conversational interviews
                                "individual_scores": [],
                                "final_results": interview_data,
                                "completion_method": "manual"
                            }
                            
                            db_success = await db.complete_interview(session["session_id"], results_data)
                            if db_success:
                                print(f"✅ Resume interview saved to database: {session['session_id']}")
                                # Invalidate cache so Past Interviews shows updated data immediately
                                from database import _interviews_cache
                                _interviews_cache["data"] = None
                                _interviews_cache["timestamp"] = 0
                                print("🔄 Cache invalidated - Past Interviews will show fresh data")
                            else:
                                print(f"❌ Failed to save resume interview to database")
                        
                        # Also save to file for backup
                        filename = f"interview_results_{interview_id}.json"
                        results_dir = "interview_results"
                        os.makedirs(results_dir, exist_ok=True)
                        filepath = os.path.join(results_dir, filename)
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            json.dump(interview_data, f, indent=2, ensure_ascii=False)
                        
                        await ws.send_text(json.dumps({
                            "type": "ended",
                            "interview_id": interview_id,
                            "download_url": f"/download_results/{interview_id}"
                        }))
                    else:
                        await ws.send_text(json.dumps({"type": "ended"}))
                except Exception as e:
                    print(f"❌ Error saving interview results: {e}")
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
    await ws.accept()
    
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
                if not topics:
                    await ws.send_text(json.dumps({
                        "type": "error", "error": "No topics selected"
                    }))
                    continue
                
                # Create technical interview session
                session = TechnicalSession(topics)
                session_id = session.session_id
                technical_sessions[session_id] = session
                
                # Send first question
                current_question = session.get_current_question()
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
                
                # Send feedback to user
                feedback_msg = f"Question {session.current_question_index + 1} completed! Score: {score}/100"
                if session.final_evaluation:
                    feedback_msg += f"\n{session.final_evaluation.get('feedback', '')}"
                
                # Store question response in database
                await session.store_question_response_in_db(
                    session.current_question_index, 
                    msg.get("code", ""), 
                    score, 
                    feedback_msg
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
                    # Interview complete
                    final_results = {
                        "session_id": session_id,
                        "topics": session.topics,
                        "total_questions": len(session.questions),
                        "completed_questions": session.current_question_index + 1,
                        "average_score": session.get_final_score(),
                        "individual_scores": session.scores,
                        "total_time": time.time() - session.start_time,
                        "voice_responses": session.voice_responses,
                        "code_submissions": session.code_submissions,
                        "questions_data": session.questions,
                        "final_evaluation": session.final_evaluation,
                        "interview_ended_manually": False
                    }
                    
                    # Store completion in database
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
                
                # Calculate final results
                final_results = {
                    "session_id": session_id,
                    "topics": session.topics,
                    "total_questions": len(session.questions),
                    "completed_questions": len(session.scores),  # Use actual completed count
                    "average_score": session.get_final_score(),
                    "individual_scores": session.scores,
                    "total_time": total_duration,
                    "voice_responses": session.voice_responses,
                    "code_submissions": session.code_submissions,
                    "questions_data": session.questions,
                    "final_evaluation": session.final_evaluation,
                    "interview_ended_manually": True,
                    "completion_status": "manually_ended",
                    "end_time": current_time
                }
                
                print("📤 Storing manual completion in database...")
                print(f"🔍 Session ID: {session_id}")
                print(f"🔍 Session object exists: {session is not None}")
                print(f"🔍 Database module loaded: {'db' in globals()}")
                
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

Context:
- Time: {time_spent/1000:.1f}s, Hints: {hints_used}, Approach discussed: {session.approach_discussed}

Scoring (0-100 total):
- Correctness: 0-25 points
- Approach discussion: -10 if none, +5 if good
- Time penalty: -1 per minute over 10min
- Hint penalty: -5 per hint
- Code quality: 0-15 points
- Understanding: 0-10 points

Respond exactly like this:
{{
    "score": 75,
    "feedback": "Brief overall assessment",
    "correctness": "Brief correctness assessment",
    "approach_quality": "Brief approach assessment", 
    "code_quality": "Brief code quality assessment",
    "areas_for_improvement": ["issue1", "issue2"]
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
            score = evaluation.get("score", 70)
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                print(f"Invalid score from LLM: {score}")
                return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)
            
            # Store detailed evaluation in session for results
            session.final_evaluation = evaluation
            return int(score)
            
    except Exception as e:
        print(f"Error in LLM evaluation: {e}")
        # Fallback to basic evaluation
        return evaluate_code_submission_fallback(session, code, language, time_spent, hints_used)


def evaluate_code_submission_fallback(session: TechnicalSession, code: str, language: str, time_spent: int, hints_used: int) -> int:
    """
    Fallback evaluation method if LLM fails
    """
    base_score = 70
    
    # Approach discussion bonus/penalty
    if not session.approach_discussed:
        base_score -= 15  # Significant penalty for not discussing approach
    elif len(session.voice_responses) > 0:
        base_score += 5  # Bonus for good approach discussion
    
    # Time penalty (more strict)
    time_minutes = time_spent / 60000
    if time_minutes > 10:
        base_score -= min(15, (time_minutes - 10) * 2)
    
    # Hint penalty (increased)
    base_score -= hints_used * 7
    
    # Code quality bonus
    quality_bonus = 0
    if len(code.strip()) > 50:
        quality_bonus += 5
    if 'def ' in code or 'function ' in code or 'class ' in code:
        quality_bonus += 8
    if any(keyword in code.lower() for keyword in ['if', 'else', 'for', 'while']):
        quality_bonus += 5
        
    final_score = max(0, min(100, base_score + quality_bonus))
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

