import os
import time
import json
import sounddevice as sd
import soundfile as sf
import numpy as np
import webrtcvad
import pyaudio
from groq import Groq
from gtts import gTTS
from dotenv import load_dotenv
from utils import get_user_topics, record_with_vad

# --- Resume reading function ---
def read_resume(resume_path):
    if resume_path.lower().endswith('.txt'):
        with open(resume_path, 'r', encoding='utf-8') as f:
            return f.read()
    elif resume_path.lower().endswith('.pdf'):
        try:
            import PyPDF2
        except ImportError:
            print("PyPDF2 not installed. Run: pip install PyPDF2")
            return ""
        with open(resume_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
    else:
        print("Unsupported resume format. Please use .txt or .pdf")
        return ""

# --- Load env ---
load_dotenv()

# Initialize Groq client with error handling
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("❌ GROQ_API_KEY not found in environment variables for interview_with_resume.py")
    client = None
else:
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully in interview_with_resume.py")
    except Exception as e:
        print(f"❌ Failed to initialize Groq client in interview_with_resume.py: {e}")
        client = None

conversation = []
# --- Prompt for LLM ---
INTERVIEWER_PROMPT = ""

def transcript_is_valid(text: str) -> bool:
    """Basic heuristic to determine if transcription is likely valid.
    Returns False for empty, very short, or obviously garbled transcripts.
    """
    if not text:
        return False
    t = text.strip()
    # Too short
    if len(t.split()) < 2:
        return False
    # Contains many non-alpha characters (whisper sometimes returns raw bytes when silent)
    non_alpha = sum(1 for c in t if not (c.isalpha() or c.isspace() or c.isdigit() or c in "',.?"))
    if non_alpha / max(1, len(t)) > 0.3:
        return False
    return True

# --- VAD Test Function ---
def test_vad_recording():
    print("Testing VAD recording. Speak a short sentence, then stay silent...")
    filename = "test_vad.wav"
    filename, heard = record_with_vad(filename)
    print(f"Recording stopped. Audio saved to {filename}. Heard speech: {heard}")
    # Play back the recorded audio
    try:
        data, sr = sf.read(filename, dtype="float32")
        print("Playing back your recording...")
        sd.play(data, sr)
        sd.wait()
    except Exception as e:
        print(f"Playback error: {e}")
    # Optionally, delete the test file
    try:
        os.remove(filename)
    except Exception as e:
        print(f"Could not delete test file: {e}")
    # Also test the retry prompt flow by simulating a no-speech scenario is manual testing

# --- TTS using gTTS ---
def say(text: str, filename="out.mp3"):
    if not text.strip():
        return
    try:
        tts = gTTS(text=text, lang="en")
        tts.save(filename)
        data, sr = sf.read(filename, dtype="float32")
        sd.play(data, sr); sd.wait()
    except Exception as e:
        print(f"TTS error: {e}")

# --- STT with Groq Whisper ---
def transcribe(path: str) -> str:
    with open(path, "rb") as f:
        result = client.audio.transcriptions.create(
            file=(path, f.read()),
            model="whisper-large-v3-turbo"
        )
    return getattr(result, "text", "").strip()

# --- LLM Interview Brain ---
def interviewer_reply(candidate: str, context: list) -> dict:
    # Use the global INTERVIEWER_PROMPT if topics not set
    global INTERVIEWER_PROMPT
    context_str = json.dumps(context[-3:], indent=2) if context else ""
    msg = [
        {"role": "system", "content": INTERVIEWER_PROMPT},
        {"role": "user", "content": f"Conversation so far: {context_str}\nCandidate: {candidate}"}
    ]
    res = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=msg,
        temperature=0.3,
        max_tokens=500
    )
    try:
        return json.loads(res.choices[0].message.content)
    except Exception:
        return {
            "evaluation": "Good attempt, but please elaborate.",
            "next_question": "What are your thoughts on data structures?",
            "hint": "",
            "final_feedback": ""
        }

# --- Main Loop ---
def run_interview():
    # --- Ask for resume path ---
    resume_path = input("Enter path to your resume (.txt or .pdf): ").strip()
    resume_text = read_resume(resume_path)
    if not resume_text:
        print("Could not read resume. Exiting.")
        return

    global INTERVIEWER_PROMPT
    INTERVIEWER_PROMPT = f"""
You are **CodeSage**, an AI technical interviewer.
You are conducting a live mock job interview with the candidate, using their resume as the primary source for questions.

### Interview Context:
- The candidate's resume is provided below. Use its content to guide your questions.
- Focus on their experience, skills, education, and projects mentioned in the resume.

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
{{
  "evaluation": "Brief feedback on the candidate's last response. MUST include a rating in format 'Rating: X/10' where X is 0-10.",
  "next_question": "Your next question for the candidate.",
  "hint": "Optional hint if asked.",
  "final_feedback": "Only include this at the end."
}}

### Evaluation Scoring:
For EVERY candidate response, evaluate based on these criteria and assign a score 0-10:

**Evaluation Criteria:**
1. Technical/Role Knowledge (30%): Does the answer demonstrate relevant technical skills or role-specific expertise mentioned in their resume?
2. Depth & Examples (25%): Does the candidate provide specific examples, details, or go beyond surface-level explanations?
3. Resume Relevance (20%): Does the answer align with what's stated in their resume? Are they expanding appropriately on resume content?
4. Clarity of Communication (15%): Is the explanation clear, well-structured, and easy to understand?
5. Candidate Initiative (10%): Does the candidate show proactivity, self-correction, or thoughtful discussion beyond just answering?

**Score Scale:**
- Include "Rating: X/10" in your evaluation field for EVERY response
- 0-3/10: Poor (off-topic, vague, contradicts resume, unclear, passive)
- 4-5/10: Below Average (partially correct but missing key details, lacks depth, some inconsistencies)
- 6-7/10: Good (correct and clear, matches resume, adequate explanation)
- 8-9/10: Excellent (detailed with examples, insightful, demonstrates strong expertise, proactive)
- 10/10: Outstanding (goes beyond expectations, exceptional depth, shows leadership/innovation)

**Important:** Always include "Rating: X/10" in the evaluation text.

Resume:
{resume_text}
"""

    say("Hello, I'm Code-Win, your AI interviewer. I will ask you questions based on your resume. Can you introduce yourself?")
    round_idx = 0

    while True:
        filename = f"ans{round_idx}.wav"
        print("🎙 Speak when ready...")
        filename, heard_speech = record_with_vad(filename)

        # If VAD didn't detect any speech, prompt user and retry a few times
        retries = 0
        max_retries = 3
        while not heard_speech and retries < max_retries:
            say("I didn't hear anything. Please speak a bit louder or check your microphone.")
            print("No speech detected by VAD. Prompted user to speak louder.")
            filename, heard_speech = record_with_vad(filename)
            retries += 1

        candidate = transcribe(filename)
        # Validate transcript quality
        if not transcript_is_valid(candidate):
            # Give one more retry if transcript looks invalid
            say("I couldn't understand that. Could you repeat more clearly?")
            print("Transcript invalid or unintelligible. Asking user to repeat.")
            filename, heard_speech = record_with_vad(filename)
            candidate = transcribe(filename)
        # Delete the answer audio file after transcription
        try:
            os.remove(filename)
        except Exception as e:
            print(f"Warning: Could not delete {filename}: {e}")

        if not candidate:
            # After retrying above, if still empty, give a hint and continue
            say("Still couldn't hear you. Try moving closer to the microphone or increasing input volume.")
            print("Empty transcript after retries. Skipping this round.")
            continue

        print("Candidate:", candidate)
        reply = interviewer_reply(candidate, conversation)

        # Store conversation
        conversation.append({
            "round": round_idx,
            "candidate": candidate,
            "evaluation": reply.get("evaluation", ""),
            "next_question": reply.get("next_question", ""),
            "hint": reply.get("hint", ""),
            "final_feedback": reply.get("final_feedback", "")
        })

        # Speak feedback + question
        if reply.get("evaluation"):
            print("🤖 Evaluation:", reply["evaluation"])
        if reply.get("hint"):
            print("🤖 Hint:", reply["hint"])
            say(reply["hint"])
        if reply.get("next_question"):
            print("🤖 Next:", reply["next_question"])
            say(reply["next_question"])
        if reply.get("final_feedback"):
            print("🤖 Final Feedback:", reply["final_feedback"])
            say("Thank you for the interview. Here is your final feedback.")
            break

        round_idx += 1


if __name__ == "__main__":
    if not os.getenv("GROQ_API_KEY"):
        print("Please set GROQ_API_KEY in your .env file")
        exit(1)
    run_interview()