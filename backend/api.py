"""
API endpoints for interview management
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import uvicorn
import random
from datetime import datetime
from database import db

app = FastAPI(title="CodeSage Interview API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://codesage-five.vercel.app/"],  # Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "CodeSage Interview API is running"}

@app.get("/api/interviews")
async def get_interviews():
    """Get all interview records with enhanced formatting"""
    try:
        interviews = await db.get_all_interviews(limit=100)
        
        # Enhanced dummy data for appealing presentation
        interviewers = [
            "Dr. Sarah Johnson", "Prof. Michael Chen", "Ms. Emily Rodriguez", 
            "Dr. James Wilson", "Ms. Priya Sharma", "Mr. David Kim",
            "Dr. Lisa Thompson", "Prof. Ahmed Hassan", "Ms. Anna Kowalski",
            "Dr. Robert Taylor", "Ms. Jessica Lee", "Prof. Carlos Martinez"
        ]
        
        # Transform the data to match frontend interface
        formatted_interviews = []
        for interview in interviews:
            # Calculate duration properly
            duration_minutes = 0
            if interview.get('duration'):
                duration_minutes = max(round(interview['duration'] / 60), 1)  # Convert seconds to minutes, min 1
            elif interview.get('start_time') and interview.get('end_time'):
                try:
                    start = datetime.fromisoformat(interview['start_time'].replace('Z', '+00:00'))
                    end = datetime.fromisoformat(interview['end_time'].replace('Z', '+00:00'))
                    duration_minutes = max(round((end - start).total_seconds() / 60), 1)
                except:
                    duration_minutes = random.randint(15, 45)  # Fallback random duration
            else:
                duration_minutes = random.randint(20, 40)  # Default fallback
            
            # Use real dates from database or current time as fallback
            interview_date = interview.get('created_at') or interview.get('start_time')
            if not interview_date:
                interview_date = datetime.now().isoformat()
            
            # Real score from database
            real_score = interview.get('average_score', 0) or 0
            
            # Dummy status (approved/rejected) - more sophisticated logic
            dummy_status = random.choice(['approved', 'rejected'])
            # Weight towards approved if score is higher
            if real_score >= 75:
                dummy_status = random.choices(['approved', 'rejected'], weights=[0.8, 0.2])[0]
            elif real_score >= 50:
                dummy_status = random.choices(['approved', 'rejected'], weights=[0.6, 0.4])[0]
            else:
                dummy_status = random.choices(['approved', 'rejected'], weights=[0.3, 0.7])[0]
            
            # Generate realistic feedback based on real score
            if real_score >= 85:
                feedbacks = [
                    "Exceptional performance! Outstanding problem-solving skills and excellent technical communication. Shows strong grasp of fundamental concepts.",
                    "Brilliant technical execution with optimal solutions. Clear thinking process and great attention to edge cases.",
                    "Impressive depth of knowledge demonstrated. Excellent coding style and efficient algorithms used throughout."
                ]
            elif real_score >= 70:
                feedbacks = [
                    "Strong performance overall. Good technical foundation with room for minor improvements in optimization.",
                    "Solid problem-solving approach with mostly correct solutions. Could benefit from more discussion of trade-offs.",
                    "Good understanding of core concepts. Clean code implementation with effective debugging skills."
                ]
            elif real_score >= 50:
                feedbacks = [
                    "Decent technical knowledge shown. Some gaps in advanced concepts but good foundational understanding.",
                    "Fair performance with correct basic approaches. Would benefit from more practice with complex scenarios.",
                    "Shows potential with good logical thinking. Needs improvement in code efficiency and time management."
                ]
            else:
                feedbacks = [
                    "Basic understanding demonstrated but needs significant improvement in problem-solving methodology.",
                    "Some technical knowledge present but requires more preparation and practice with coding fundamentals.",
                    "Shows effort and willingness to learn. Recommend focusing on data structures and algorithmic thinking."
                ]
            
            # Real data from database with enhanced formatting
            formatted_interview = {
                "id": str(interview.get('id', interview.get('session_id', f'int_{random.randint(1000, 9999)}'))),
                "type": interview.get("interview_type", "technical"),
                "date": interview_date,
                "duration": duration_minutes,
                "score": real_score,  # Real score from database
                "status": dummy_status,  # Dummy status as requested
                "topics": interview.get("topics", []) if interview.get("topics") else ['Python', 'Data Structures', 'Algorithms'],
                "questions_completed": interview.get("completed_questions", 0),  # Real data
                "total_questions": interview.get("total_questions", 0),  # Real data
                "interviewer": random.choice(interviewers),  # Dummy interviewer
                "feedback": random.choice(feedbacks)  # Contextual feedback
            }
            formatted_interviews.append(formatted_interview)
        
        return {
            "interviews": formatted_interviews,
            "total": len(formatted_interviews),
            "message": f"Successfully fetched {len(formatted_interviews)} interviews"
        }
    
    except Exception as e:
        print(f"❌ Error fetching interviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)