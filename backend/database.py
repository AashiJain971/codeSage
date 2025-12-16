"""
Database configuration and operations for Supabase
"""
import os
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, List, Any
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

print(f"🔗 Supabase URL: {SUPABASE_URL}")
print(f"🔑 Supabase Key status: {'✅ Found' if SUPABASE_ANON_KEY else '❌ Missing'}")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Missing Supabase credentials in .env file")
    supabase: Optional[Client] = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        print("✅ Supabase client initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Supabase client: {e}")
        supabase = None


class InterviewDatabase:
    """Handle all interview-related database operations"""
    
    def __init__(self):
        self.supabase = supabase
        
    async def create_interview_session(self, session_data: Dict[str, Any]) -> Optional[str]:
        """Create a new interview session record"""
        if not self.supabase:
            print("❌ Supabase client not available")
            return None
            
        try:
            # Prepare the interview session data
            start_time = session_data.get("start_time")
            if isinstance(start_time, (int, float)):
                start_time = datetime.fromtimestamp(start_time).isoformat()
            
            insert_data = {
                "session_id": session_data.get("session_id"),
                "interview_type": session_data.get("interview_type", "technical"),
                "topics": session_data.get("topics", []),
                # Store start_time as ISO string (if provided) or NULL
                "start_time": start_time,
                "status": "in_progress",
                "total_questions": session_data.get("total_questions", 0),
                # Store current question index as 1-based for the DB while internal logic remains 0-based
                "current_question_index": (session_data.get("current_question_index", 0) + 1),
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("interviews").insert(insert_data).execute()
            
            if result.data:
                print(f"✅ Interview session created with ID: {result.data[0]['id']}")
                return result.data[0]['id']
            else:
                print("❌ Failed to create interview session")
                return None
                
        except Exception as e:
            print(f"❌ Error creating interview session: {e}")
            return None
    
    async def update_interview_progress(self, session_id: str, progress_data: Dict[str, Any]) -> bool:
        """Update interview progress"""
        if not self.supabase:
            return False
            
        try:
            update_data = {}
            
            # Convert internal 0-based index to 1-based when saving to DB
            if "current_question_index" in progress_data:
                try:
                    internal_idx = int(progress_data["current_question_index"])
                except Exception:
                    internal_idx = progress_data["current_question_index"]
                update_data["current_question_index"] = (internal_idx + 1)
            
            if "completed_questions" in progress_data:
                update_data["completed_questions"] = progress_data["completed_questions"]
                
            if update_data:
                update_data["updated_at"] = datetime.utcnow().isoformat()
                
                result = self.supabase.table("interviews").update(update_data).eq("session_id", session_id).execute()
                
                if result.data:
                    print(f"✅ Interview progress updated for session: {session_id}")
                    return True
                    
        except Exception as e:
            print(f"❌ Error updating interview progress: {e}")
            
        return False
    
    async def complete_interview(self, session_id: str, results_data: Dict[str, Any]) -> bool:
        """Mark interview as completed and store results"""
        if not self.supabase:
            print("❌ Supabase client not available for interview completion")
            return False
            
        try:
            # Prepare the completion data
            end_time = results_data.get("end_time")
            if isinstance(end_time, (int, float)):
                end_time = datetime.fromtimestamp(end_time).isoformat()
            
            total_time = results_data.get("total_time", 0)
            if isinstance(total_time, float):
                total_time = int(total_time)  # Convert to integer seconds
            
            # Convert average_score to integer if it's a float
            average_score = results_data.get("average_score")
            if isinstance(average_score, float):
                average_score = int(average_score)
            
            # Convert individual scores to integers if they're floats
            individual_scores = results_data.get("individual_scores", [])
            if individual_scores:
                individual_scores = [int(score) if isinstance(score, float) else score for score in individual_scores]
            
            update_data = {
                "status": "completed",
                "end_time": end_time,
                "duration": total_time,
                "completed_questions": results_data.get("completed_questions", 0),
                "average_score": average_score,
                "individual_scores": individual_scores,
                # Store the complete results payload for audit
                "final_results": results_data,
                # Normalize completion_method key: prefer completion_status or completion_method
                "completion_method": results_data.get("completion_status") or results_data.get("completion_method") or "automatic",
                "updated_at": datetime.utcnow().isoformat()
            }
            
            print(f"🔄 Attempting to complete interview for session: {session_id}")
            print(f"📊 Update data:")
            print(f"   Status: {update_data['status']}")
            print(f"   End Time: {update_data['end_time']}")
            print(f"   Duration: {update_data['duration']} seconds")
            print(f"   Completed Questions: {update_data['completed_questions']}")
            print(f"   Average Score: {update_data['average_score']}")
            
            # First check if the session exists
            try:
                existing_session = self.supabase.table("interviews").select("session_id, status, created_at").eq("session_id", session_id).execute()
                if existing_session.data and len(existing_session.data) > 0:
                    print(f"✅ Session found: {existing_session.data[0]}")
                else:
                    print(f"❌ Session {session_id} not found in database!")
                    print("🔍 Checking recent sessions...")
                    recent = self.supabase.table("interviews").select("session_id, created_at").order("created_at", desc=True).limit(5).execute()
                    for r in recent.data:
                        print(f"   📝 {r.get('session_id')} - {r.get('created_at')}")
                    return False
            except Exception as e:
                print(f"❌ Error checking session existence: {e}")
            
            result = self.supabase.table("interviews").update(update_data).eq("session_id", session_id).execute()
            
            if result.data and len(result.data) > 0:
                print(f"✅ Interview completed successfully for session: {session_id}")
                print(f"📈 Final data: {result.data[0].get('status')} - {result.data[0].get('duration')}s - {result.data[0].get('average_score')}/100")
                return True
            else:
                print(f"❌ Failed to complete interview for session: {session_id}")
                print(f"🔍 Result data: {result.data}")
                return False
                
        except Exception as e:
            print(f"❌ Error completing interview: {e}")
            return False
    
    async def get_interview_results(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get interview results by session ID"""
        if not self.supabase:
            return None
            
        try:
            result = self.supabase.table("interviews").select("*").eq("session_id", session_id).execute()
            
            if result.data and len(result.data) > 0:
                interview_data = result.data[0]

                # Return formatted results using .get to avoid KeyError when schema differs
                return {
                    "session_id": interview_data.get("session_id"),
                    "id": interview_data.get("id"),
                    "interview_type": interview_data.get("interview_type"),
                    "topics": interview_data.get("topics") or [],
                    "total_questions": interview_data.get("total_questions") or 0,
                    "completed_questions": interview_data.get("completed_questions") or 0,
                    "average_score": interview_data.get("average_score") or 0,
                    "individual_scores": interview_data.get("individual_scores") or [],
                    # Provide both duration and total_time keys for frontend compatibility
                    "duration": interview_data.get("duration") or 0,
                    "total_time": interview_data.get("duration") or 0,
                    "start_time": interview_data.get("start_time"),
                    "end_time": interview_data.get("end_time"),
                    "status": interview_data.get("status") or interview_data.get("completion_method") or "unknown",
                    "completion_method": interview_data.get("completion_method"),
                    "created_at": interview_data.get("created_at"),
                    "final_results": interview_data.get("final_results") or {}
                }
            else:
                print(f"❌ No interview found for session: {session_id}")
                return None
                
        except Exception as e:
            print(f"❌ Error getting interview results: {e}")
            return None
    
    async def get_all_interviews(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all interview records with optional limit"""
        if not self.supabase:
            return []
            
        try:
            result = self.supabase.table("interviews").select("*").order("created_at", desc=True).limit(limit).execute()
            
            if result.data:
                return result.data
            else:
                return []
                
        except Exception as e:
            print(f"❌ Error getting all interviews: {e}")
            return []
    
    async def store_question_response(self, session_id: str, question_index: int, question_data: Dict[str, Any]) -> bool:
        """Store individual question and response data"""
        if not self.supabase:
            return False
            
        try:
            # question_index expected to be 1-based from caller
            insert_data = {
                "session_id": session_id,
                "question_index": int(question_index),
                "question_text": question_data.get("question"),
                "user_response": question_data.get("user_response"),
                "score": question_data.get("score"),
                "feedback": question_data.get("feedback"),
                "time_taken": question_data.get("time_taken"),
                "hints_used": question_data.get("hints_used", 0),
                "difficulty": question_data.get("difficulty"),
                "created_at": datetime.utcnow().isoformat()
            }
            
            result = self.supabase.table("question_responses").insert(insert_data).execute()
            
            if result.data:
                print(f"✅ Question response stored for session: {session_id}, question: {question_index}")
                return True
            else:
                print(f"❌ Failed to store question response")
                return False
                
        except Exception as e:
            print(f"❌ Error storing question response: {e}")
            return False
    
    async def get_question_responses(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all question responses for a session"""
        if not self.supabase:
            return []
            
        try:
            # return ordered by question_index (which is 1-based)
            result = self.supabase.table("question_responses").select("*").eq("session_id", session_id).order("question_index").execute()
            
            if result.data:
                return result.data
            else:
                return []
                
        except Exception as e:
            print(f"❌ Error getting question responses: {e}")
            return []


# Global database instance
db = InterviewDatabase()