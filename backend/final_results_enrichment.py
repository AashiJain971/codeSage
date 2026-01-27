"""
LLM-Based Final Results Enrichment Module
Generates structured, recruiter-grade final_results for both resume and technical interviews.
"""

import os
import json
from typing import Dict, List, Any
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("❌ GROQ_API_KEY not found in environment variables for final_results_enrichment.py")
    client = None
else:
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully in final_results_enrichment.py")
    except Exception as e:
        print(f"❌ Failed to initialize Groq client in final_results_enrichment.py: {e}")
        client = None


def enrich_resume_interview_results(
    conversation: List[Dict],
    individual_scores: List[float],
    average_score: float,
    duration: int,
    resume_text: str = None
) -> Dict:
    """
    Generate enriched final_results for resume-based interviews using LLM.
    
    Args:
        conversation: List of interview rounds with questions and answers
        individual_scores: List of scores for each question
        average_score: Average score across all questions
        duration: Interview duration in seconds
        resume_text: Optional resume text for context
        
    Returns:
        Structured final_results dictionary
    """
    if not client:
        return _get_fallback_resume_results(conversation, individual_scores, average_score)
    
    # Prepare conversation summary for LLM
    conversation_text = ""
    for i, round_data in enumerate(conversation):
        conversation_text += f"\n--- Round {i+1} ---\n"
        conversation_text += f"Question: {round_data.get('question', 'N/A')}\n"
        conversation_text += f"Candidate Response: {round_data.get('answer', 'N/A')}\n"
        conversation_text += f"Evaluation: {round_data.get('evaluation', 'N/A')}\n"
        if 'score' in round_data:
            conversation_text += f"Score: {round_data['score']}/10\n"
    
    prompt = f"""You are an expert technical recruiter analyzing a resume-based interview. Generate a comprehensive, structured evaluation in JSON format.

INTERVIEW DATA:
Duration: {duration} seconds
Average Score: {average_score:.1f}/100
Individual Scores: {individual_scores}
Total Questions: {len(conversation)}

{conversation_text}

{"Resume Context: " + resume_text[:1000] if resume_text else ""}

Generate a JSON response with this EXACT structure (no additional text, ONLY valid JSON):

{{
  "interview_type": "resume",
  "interview_summary": {{
    "overall_assessment": "2-3 sentence summary of candidate performance",
    "hire_recommendation": "strong_yes|yes|borderline|no",
    "confidence_level": "low|medium|high"
  }},
  "strengths": [
    "Specific strength 1",
    "Specific strength 2"
  ],
  "areas_for_improvement": [
    "Specific area 1",
    "Specific area 2"
  ],
  "skill_signal_map": {{
    "communication": 7,
    "clarity_of_thought": 8,
    "domain_knowledge": 6,
    "ownership": 7,
    "learning_ability": 8
  }},
  "resume_alignment": {{
    "verified_skills": ["skill1", "skill2"],
    "weak_or_unverified_skills": ["skill3"],
    "consistency_level": "high|medium|low"
  }},
  "risk_flags": [
    "ONLY include if observed: vague_explanations, resume_overclaim, shallow_examples, low_impact_work"
  ],
  "evaluation_metadata": {{
    "evaluation_model": "llama-3.3-70b-versatile",
    "scoring_method": "rubric_v1",
    "completion_method": "automatic",
    "signals_used": ["question_scores", "feedback_text", "time_taken"]
  }}
}}

IMPORTANT: 
- skill_signal_map values must be 0-10 integers
- hire_recommendation must be one of: strong_yes, yes, borderline, no
- confidence_level must be one of: low, medium, high
- Only include risk_flags that were actually observed
- Return ONLY valid JSON, no markdown formatting or explanatory text"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Clean up markdown formatting if present
        if result_text.startswith("```json"):
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif result_text.startswith("```"):
            result_text = result_text.split("```")[1].split("```")[0].strip()
        
        enriched_results = json.loads(result_text)
        
        # Validate and ensure all required fields are present
        enriched_results = _validate_resume_results(enriched_results)
        
        print("✅ Resume interview results enriched successfully")
        return enriched_results
        
    except Exception as e:
        print(f"❌ Error enriching resume results with LLM: {e}")
        return _get_fallback_resume_results(conversation, individual_scores, average_score)


def enrich_technical_interview_results(
    questions_data: List[Dict],
    scores: List[float],
    average_score: float,
    code_submissions: List[Dict],
    voice_responses: List[str],
    duration: int,
    topics: List[str]
) -> Dict:
    """
    Generate enriched final_results for technical interviews using LLM.
    
    Args:
        questions_data: List of questions with metadata
        scores: List of scores for each question
        average_score: Average score across all questions
        code_submissions: List of code submissions with metadata
        voice_responses: List of voice/text responses
        duration: Interview duration in seconds
        topics: List of topics covered
        
    Returns:
        Structured final_results dictionary
    """
    if not client:
        return _get_fallback_technical_results(questions_data, scores, average_score, topics)
    
    # Prepare technical interview summary
    technical_summary = f"Topics: {', '.join(topics)}\n"
    technical_summary += f"Duration: {duration} seconds\n"
    technical_summary += f"Average Score: {average_score:.1f}/100\n"
    technical_summary += f"Total Questions: {len(questions_data)}\n\n"
    
    for i, (question, score) in enumerate(zip(questions_data, scores)):
        technical_summary += f"\n--- Question {i+1} ---\n"
        technical_summary += f"Question: {question.get('question', 'N/A')[:200]}\n"
        technical_summary += f"Difficulty: {question.get('difficulty', 'N/A')}\n"
        technical_summary += f"Score: {score}/100\n"
        
        if i < len(code_submissions) and code_submissions[i]:
            code = code_submissions[i].get('code', '')[:300]
            technical_summary += f"Code Submission: {code}\n"
            technical_summary += f"Hints Used: {code_submissions[i].get('hints_used', 0)}\n"
    
    prompt = f"""You are an expert technical interviewer analyzing a coding interview. Generate a comprehensive, structured evaluation in JSON format.

INTERVIEW DATA:
{technical_summary}

Generate a JSON response with this EXACT structure (no additional text, ONLY valid JSON):

{{
  "interview_type": "technical",
  "interview_summary": {{
    "overall_assessment": "2-3 sentence summary of technical performance",
    "problem_solving_quality": "strong|average|weak",
    "coding_confidence": "low|medium|high",
    "hire_recommendation": "strong_yes|yes|borderline|no"
  }},
  "strengths": [
    "Specific technical strength 1",
    "Specific technical strength 2"
  ],
  "areas_for_improvement": [
    "Specific area 1",
    "Specific area 2"
  ],
  "technical_signal_breakdown": {{
    "correctness_trend": "improving|consistent|declining",
    "hint_dependency": "low|medium|high",
    "debugging_ability": "strong|average|weak",
    "optimization_awareness": "strong|average|weak"
  }},
  "skill_signal_map": {{
    "problem_solving": 7,
    "data_structures": 8,
    "algorithms": 6,
    "code_clarity": 7,
    "communication": 8
  }},
  "risk_flags": [
    "ONLY include if observed: over_reliance_on_hints, weak_fundamentals, copy_pattern_solutions, poor_time_management"
  ],
  "evaluation_metadata": {{
    "evaluation_model": "llama-3.3-70b-versatile",
    "scoring_method": "rubric_v1",
    "completion_method": "automatic",
    "signals_used": ["question_scores", "code_submission", "hints_used", "time_taken"]
  }}
}}

IMPORTANT:
- skill_signal_map values must be 0-10 integers
- hire_recommendation must be one of: strong_yes, yes, borderline, no
- problem_solving_quality must be: strong, average, or weak
- coding_confidence must be: low, medium, or high
- Only include risk_flags that were actually observed
- Return ONLY valid JSON, no markdown formatting or explanatory text"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2000
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Clean up markdown formatting if present
        if result_text.startswith("```json"):
            result_text = result_text.split("```json")[1].split("```")[0].strip()
        elif result_text.startswith("```"):
            result_text = result_text.split("```")[1].split("```")[0].strip()
        
        enriched_results = json.loads(result_text)
        
        # Validate and ensure all required fields are present
        enriched_results = _validate_technical_results(enriched_results)
        
        print("✅ Technical interview results enriched successfully")
        return enriched_results
        
    except Exception as e:
        print(f"❌ Error enriching technical results with LLM: {e}")
        return _get_fallback_technical_results(questions_data, scores, average_score, topics)


def _validate_resume_results(results: Dict) -> Dict:
    """Ensure all required fields are present in resume results"""
    template = {
        "interview_type": "resume",
        "interview_summary": {
            "overall_assessment": results.get("interview_summary", {}).get("overall_assessment", "Assessment not available"),
            "hire_recommendation": results.get("interview_summary", {}).get("hire_recommendation", "borderline"),
            "confidence_level": results.get("interview_summary", {}).get("confidence_level", "medium")
        },
        "strengths": results.get("strengths", ["Communication skills", "Technical knowledge"]),
        "areas_for_improvement": results.get("areas_for_improvement", ["Provide more specific examples"]),
        "skill_signal_map": {
            "communication": results.get("skill_signal_map", {}).get("communication", 5),
            "clarity_of_thought": results.get("skill_signal_map", {}).get("clarity_of_thought", 5),
            "domain_knowledge": results.get("skill_signal_map", {}).get("domain_knowledge", 5),
            "ownership": results.get("skill_signal_map", {}).get("ownership", 5),
            "learning_ability": results.get("skill_signal_map", {}).get("learning_ability", 5)
        },
        "resume_alignment": results.get("resume_alignment", {
            "verified_skills": [],
            "weak_or_unverified_skills": [],
            "consistency_level": "medium"
        }),
        "risk_flags": results.get("risk_flags", []),
        "evaluation_metadata": results.get("evaluation_metadata", {
            "evaluation_model": "llama-3.3-70b-versatile",
            "scoring_method": "rubric_v1",
            "completion_method": "automatic",
            "signals_used": ["question_scores", "feedback_text", "time_taken"]
        })
    }
    return template


def _validate_technical_results(results: Dict) -> Dict:
    """Ensure all required fields are present in technical results"""
    template = {
        "interview_type": "technical",
        "interview_summary": {
            "overall_assessment": results.get("interview_summary", {}).get("overall_assessment", "Assessment not available"),
            "problem_solving_quality": results.get("interview_summary", {}).get("problem_solving_quality", "average"),
            "coding_confidence": results.get("interview_summary", {}).get("coding_confidence", "medium"),
            "hire_recommendation": results.get("interview_summary", {}).get("hire_recommendation", "borderline")
        },
        "strengths": results.get("strengths", ["Problem solving approach", "Code structure"]),
        "areas_for_improvement": results.get("areas_for_improvement", ["Algorithm optimization"]),
        "technical_signal_breakdown": {
            "correctness_trend": results.get("technical_signal_breakdown", {}).get("correctness_trend", "consistent"),
            "hint_dependency": results.get("technical_signal_breakdown", {}).get("hint_dependency", "medium"),
            "debugging_ability": results.get("technical_signal_breakdown", {}).get("debugging_ability", "average"),
            "optimization_awareness": results.get("technical_signal_breakdown", {}).get("optimization_awareness", "average")
        },
        "skill_signal_map": {
            "problem_solving": results.get("skill_signal_map", {}).get("problem_solving", 5),
            "data_structures": results.get("skill_signal_map", {}).get("data_structures", 5),
            "algorithms": results.get("skill_signal_map", {}).get("algorithms", 5),
            "code_clarity": results.get("skill_signal_map", {}).get("code_clarity", 5),
            "communication": results.get("skill_signal_map", {}).get("communication", 5)
        },
        "risk_flags": results.get("risk_flags", []),
        "evaluation_metadata": results.get("evaluation_metadata", {
            "evaluation_model": "llama-3.3-70b-versatile",
            "scoring_method": "rubric_v1",
            "completion_method": "automatic",
            "signals_used": ["question_scores", "code_submission", "hints_used", "time_taken"]
        })
    }
    return template


def _get_fallback_resume_results(conversation: List[Dict], individual_scores: List[float], average_score: float) -> Dict:
    """Fallback resume results when LLM is unavailable"""
    return {
        "interview_type": "resume",
        "interview_summary": {
            "overall_assessment": f"Resume interview completed with {len(conversation)} questions answered. Average score: {average_score:.1f}/100.",
            "hire_recommendation": "yes" if average_score >= 70 else "borderline" if average_score >= 50 else "no",
            "confidence_level": "medium"
        },
        "strengths": ["Completed interview", "Provided responses"],
        "areas_for_improvement": ["Detailed evaluation requires LLM"],
        "skill_signal_map": {
            "communication": min(10, int(average_score / 10)),
            "clarity_of_thought": min(10, int(average_score / 10)),
            "domain_knowledge": min(10, int(average_score / 10)),
            "ownership": min(10, int(average_score / 10)),
            "learning_ability": min(10, int(average_score / 10))
        },
        "resume_alignment": {
            "verified_skills": [],
            "weak_or_unverified_skills": [],
            "consistency_level": "medium"
        },
        "risk_flags": [],
        "evaluation_metadata": {
            "evaluation_model": "fallback",
            "scoring_method": "rubric_v1",
            "completion_method": "automatic",
            "signals_used": ["question_scores"]
        }
    }


def _get_fallback_technical_results(questions_data: List[Dict], scores: List[float], average_score: float, topics: List[str]) -> Dict:
    """Fallback technical results when LLM is unavailable"""
    return {
        "interview_type": "technical",
        "interview_summary": {
            "overall_assessment": f"Technical interview on {', '.join(topics)} completed with {len(questions_data)} questions. Average score: {average_score:.1f}/100.",
            "problem_solving_quality": "strong" if average_score >= 75 else "average" if average_score >= 50 else "weak",
            "coding_confidence": "high" if average_score >= 75 else "medium" if average_score >= 50 else "low",
            "hire_recommendation": "yes" if average_score >= 70 else "borderline" if average_score >= 50 else "no"
        },
        "strengths": ["Completed coding interview", "Submitted solutions"],
        "areas_for_improvement": ["Detailed evaluation requires LLM"],
        "technical_signal_breakdown": {
            "correctness_trend": "consistent",
            "hint_dependency": "medium",
            "debugging_ability": "average",
            "optimization_awareness": "average"
        },
        "skill_signal_map": {
            "problem_solving": min(10, int(average_score / 10)),
            "data_structures": min(10, int(average_score / 10)),
            "algorithms": min(10, int(average_score / 10)),
            "code_clarity": min(10, int(average_score / 10)),
            "communication": min(10, int(average_score / 10))
        },
        "risk_flags": [],
        "evaluation_metadata": {
            "evaluation_model": "fallback",
            "scoring_method": "rubric_v1",
            "completion_method": "automatic",
            "signals_used": ["question_scores", "code_submission"]
        }
    }


# Test function
def test_enrichment():
    """Test enrichment functions with sample data"""
    print("\n" + "="*60)
    print("TESTING RESUME INTERVIEW ENRICHMENT")
    print("="*60)
    
    sample_conversation = [
        {
            "question": "Tell me about your experience with Python",
            "answer": "I have been working with Python for 3 years, primarily in data analysis and backend development.",
            "evaluation": "Good overview. Rating: 7/10",
            "score": 70
        },
        {
            "question": "Describe a challenging project you worked on",
            "answer": "I built a real-time data pipeline processing millions of events per day using Apache Kafka and Python.",
            "evaluation": "Excellent example with specific details. Rating: 9/10",
            "score": 90
        }
    ]
    
    resume_results = enrich_resume_interview_results(
        conversation=sample_conversation,
        individual_scores=[70, 90],
        average_score=80,
        duration=600,
        resume_text="Software Engineer with 3 years experience in Python and distributed systems"
    )
    
    print("\n📊 Resume Interview Results:")
    print(json.dumps(resume_results, indent=2))
    
    print("\n" + "="*60)
    print("TESTING TECHNICAL INTERVIEW ENRICHMENT")
    print("="*60)
    
    sample_questions = [
        {
            "question": "Implement a function to reverse a linked list",
            "difficulty": "medium",
            "topics": ["data structures", "linked lists"]
        },
        {
            "question": "Find the longest palindromic substring",
            "difficulty": "hard",
            "topics": ["algorithms", "dynamic programming"]
        }
    ]
    
    sample_code_submissions = [
        {
            "code": "def reverse_list(head): ...",
            "hints_used": 1
        },
        {
            "code": "def longest_palindrome(s): ...",
            "hints_used": 2
        }
    ]
    
    technical_results = enrich_technical_interview_results(
        questions_data=sample_questions,
        scores=[75, 65],
        average_score=70,
        code_submissions=sample_code_submissions,
        voice_responses=["Let me think about this...", "I'll use dynamic programming"],
        duration=1800,
        topics=["data structures", "algorithms"]
    )
    
    print("\n📊 Technical Interview Results:")
    print(json.dumps(technical_results, indent=2))
    
    print("\n✅ Enrichment tests completed!")


if __name__ == "__main__":
    test_enrichment()
