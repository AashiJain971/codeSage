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
from utils import build_interviewer_prompt, get_user_topics, record_with_vad

# --- Load env ---
load_dotenv()

# Initialize Groq client with error handling
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("❌ GROQ_API_KEY not found in environment variables for interview.py")
    client = None
else:
    try:
        client = Groq(api_key=api_key)
        print("✅ Groq client initialized successfully in interview.py")
    except Exception as e:
        print(f"❌ Failed to initialize Groq client in interview.py: {e}")
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
    # Topic selection
    topics = get_user_topics()
    global INTERVIEWER_PROMPT
    INTERVIEWER_PROMPT = build_interviewer_prompt(topics)
    # Add instruction for jargon correction
    INTERVIEWER_PROMPT += (
        "\nIf the candidate uses a technical term or jargon that is misspelled or not recognized "
        "(for example, 'kosarachi' instead of 'kosaraju'), try to infer the intended word and "
        "suggest the closest possible correct term in your feedback."
    )
    INTERVIEWER_PROMPT = build_interviewer_prompt(topics)

    say("Hello, I'm CodeSage, your AI interviewer. Can you introduce yourself?")
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
    print("Select mode:")
    print("1. Run Interview")
    print("2. Test VAD Recording")
    mode = input("Enter 1 or 2: ").strip()
    if mode == "2":
        test_vad_recording()
    else:
        if not os.getenv("GROQ_API_KEY"):
            print("Please set GROQ_API_KEY in your .env file")
            exit(1)
        run_interview()