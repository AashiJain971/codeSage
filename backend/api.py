"""
FastAPI backend for CodeSage Interview System
Comprehensive API endpoints for interview data, analytics, and exports
"""
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from database import db
from auth_middleware import get_current_user
import json
import io
import csv
from collections import defaultdict

app = FastAPI(title="CodeSage Interview API", version="2.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://codesage-5iht.onrender.com",
    ],
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
    user_id: str = Depends(get_current_user),
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
    Get all interviews for the authenticated user with pagination and filtering
    """
    try:
        # Fetch all interviews for this user from database
        all_interviews = await db.get_user_interviews(user_id, limit=1000)
        
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
        
        # Generate strengths and improvements based on skills
        strengths = []
        improvements = []
        
        sorted_skills = sorted(skills.items(), key=lambda x: x[1], reverse=True)
        for skill, value in sorted_skills[:3]:
            if value >= 70:
                strengths.append(f"Strong {skill.replace('_', ' ')} capabilities ({value}%)")
        
        for skill, value in sorted_skills[-3:]:
            if value < 70:
                improvements.append(f"Develop {skill.replace('_', ' ')} skills (currently {value}%)")
        
        # Add performance-based strengths
        if completion_rate >= 80:
            strengths.append(f"High completion rate ({completion_rate:.0f}%)")
        if average_score >= 75:
            strengths.append(f"Consistent high performance (avg {average_score:.0f}%)")
        if trend == "improving":
            strengths.append("Demonstrating continuous improvement")
        
        # Add default strengths if list is empty
        if not strengths:
            strengths = [
                "Active interview participant",
                "Building technical interview experience",
                "Committed to skill development"
            ]
        
        # Add default improvements if list is empty
        if not improvements:
            improvements = [
                "Continue practicing to build consistency",
                "Focus on completing more interviews",
                "Strengthen foundational skills"
            ]
        
        # Calculate trust score
        trust_score = min(100, (
            (total_interviews * 5) +  # 5 points per interview
            (average_score * 0.3) +    # 30% weight on average score
            (completion_rate * 0.2) +  # 20% weight on completion rate
            (20 if trend == "improving" else 10)  # Bonus for improvement
        ))
        
        # Prepare interview list (limit to recent 50)
        interview_list = [
            {
                "id": i["id"],
                "type": i["type"],
                "date": i["date"],
                "score": i["score"],
                "topics": i["topics"],
                "duration": i["duration"]
            }
            for i in sorted(formatted_interviews, key=lambda x: x["date"], reverse=True)[:50]
        ]
        
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
            "strengths": strengths,
            "improvements": improvements,
            "trustScore": round(trust_score, 0)
        }
        
    except Exception as e:
        print(f"❌ Error in get_user_profile: {e}")
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
