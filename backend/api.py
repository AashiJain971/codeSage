"""
FastAPI backend for CodeSage Interview System
Comprehensive API endpoints for interview data, analytics, and exports
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from database import db
import json
import io
import csv
from collections import defaultdict

app = FastAPI(title="CodeSage Interview API", version="2.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://codesage-five.vercel.app/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



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
    # Calculate duration in minutes
    duration_seconds = interview.get("duration", 0) or 0
    duration_minutes = round(duration_seconds / 60) if duration_seconds > 0 else 0
    
    # Calculate status
    completion_method = interview.get("completion_method", "automatic")
    average_score = interview.get("average_score")
    status = calculate_status(completion_method, average_score)
    
    # Extract interviewer from final_results or default
    final_results = interview.get("final_results", {})
    if isinstance(final_results, str):
        try:
            final_results = json.loads(final_results)
        except:
            final_results = {}
    
    interviewer = final_results.get("interviewer", "AI Interviewer")
    
    # Extract topics
    topics = interview.get("topics", [])
    if not topics:
        topics = final_results.get("topics", [])
    
    # Format feedback from final_results
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


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "CodeSage Interview API", "version": "2.0"}


@app.get("/api/interviews")
async def get_interviews(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[str] = Query(None),
    interview_type: Optional[str] = Query(None),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    max_score: Optional[int] = Query(None, ge=0, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    """
    Get all interviews with pagination and filtering
    """
    try:
        # Fetch all interviews from database
        all_interviews = await db.get_all_interviews(limit=1000)
        
        if not all_interviews:
            return {
                "interviews": [],
                "total": 0,
                "page": page,
                "limit": limit,
                "pages": 0
            }
        
        # Format interviews
        formatted_interviews = [format_interview_data(interview) for interview in all_interviews]
        
        # Apply filters
        filtered = formatted_interviews
        
        if status_filter:
            filtered = [i for i in filtered if i["status"] == status_filter]
        
        if interview_type:
            filtered = [i for i in filtered if i["type"] == interview_type]
        
        if min_score is not None:
            filtered = [i for i in filtered if i["score"] >= min_score]
        
        if max_score is not None:
            filtered = [i for i in filtered if i["score"] <= max_score]
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            filtered = [i for i in filtered if datetime.fromisoformat(i["date"].replace('Z', '+00:00')) >= start_dt]
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            filtered = [i for i in filtered if datetime.fromisoformat(i["date"].replace('Z', '+00:00')) <= end_dt]
        
        # Pagination
        total = len(filtered)
        pages = (total + limit - 1) // limit
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated = filtered[start_idx:end_idx]
        
        return {
            "interviews": paginated,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages
        }
        
    except Exception as e:
        print(f"❌ Error in get_interviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/stats/overview")
async def get_stats_overview():
    """Get overall statistics and metrics"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        total = len(formatted)
        if total == 0:
            return {
                "total": 0,
                "approved": 0,
                "rejected": 0,
                "manually_ended": 0,
                "timeout": 0,
                "average_score": 0,
                "average_duration": 0,
                "total_questions_answered": 0,
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
            "total": total,
            "approved": approved,
            "rejected": rejected,
            "manually_ended": manually_ended,
            "timeout": timeout,
            "average_score": average_score,
            "average_duration": average_duration,
            "total_questions_answered": total_questions,
            "completion_rate": completion_rate
        }
    except Exception as e:
        print(f"❌ Error in get_stats_overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/interviews/analytics/performance")
async def get_performance_analytics():
    """Get  performance analytics including topic breakdown and trends"""
    try:
        all_interviews = await db.get_all_interviews(limit=1000)
        formatted = [format_interview_data(i) for i in all_interviews]
        
        if not formatted:
            return {
                "topic_performance": [],
                "score_distribution": {},
                "time_efficiency": {},
                "improvement_trend": [],
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
        
        time_efficiency = {}
        for interview in formatted:
            if interview["duration"] > 0:
                efficiency = interview["score"] / interview["duration"]
                time_efficiency[interview["id"]] = round(efficiency, 2)
        
        avg_efficiency = round(sum(time_efficiency.values()) / len(time_efficiency), 2) if time_efficiency else 0
        
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
            "time_efficiency": {"average": avg_efficiency, "by_interview": time_efficiency},
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
        
        manually_ended = len([i for i in formatted if i["status"] == "manually_ended"])
        if manually_ended > 2:
            recommendations.append({
                "category": "Consistency",
                "suggestion": "Try to complete interviews without ending them manually.",
                "priority": "medium"
            })
        
        sorted_interviews = sorted(formatted, key=lambda x: x["date"])
        if len(sorted_interviews) >= 3:
            recent_scores = [i["score"] for i in sorted_interviews[-3:] if i["score"] > 0]
            if len(recent_scores) >= 2 and recent_scores[-1] < recent_scores[0]:
                recommendations.append({
                    "category": "Performance",
                    "suggestion": "Recent scores show a decline. Consider reviewing fundamentals.",
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


@app.get("/api/interviews/{session_id}")
async def get_interview_detail(session_id: str):
    """Get detailed interview information including all question responses"""
    try:
        interview = await db.get_interview_results(session_id)
        if not interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        
        questions = await db.get_question_responses(session_id)
        formatted = format_interview_data(interview)
        formatted["questions"] = [
            {
                "index": q.get("question_index"),
                "question_text": q.get("question_text"),
                "user_response": q.get("user_response"),
                "code_submission": q.get("code_submission"),
                "score": q.get("score"),
                "feedback": q.get("feedback"),
                "time_taken": q.get("time_taken"),
                "hints_used": q.get("hints_used"),
                "difficulty": q.get("difficulty"),
                "created_at": q.get("created_at")
            }
            for q in questions
        ]
        return formatted
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error in get_interview_detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
