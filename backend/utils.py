import soundfile as sf
import numpy as np
import webrtcvad
import pyaudio

# --- Topic Options ---
TOPIC_OPTIONS = [
    "DSA", "DBMS", "System Design", "OOPS", "Operating systems", "Computer networks"
]
SAMPLE_RATE = 16000
FRAME_DURATION = 30  # ms
FRAME_SIZE = int(SAMPLE_RATE * FRAME_DURATION / 1000)
CHANNELS = 1
FORMAT = pyaudio.paInt16

def build_interviewer_prompt(topics):
    topics_str = ", ".join(topics)
    return f"""
You are **CodeSage**, an AI technical interviewer. 
You are conducting a live mock job interview with the candidate.

### Interview Topics:
- Only ask questions from the following topics: {topics_str}

### Interview Style:
- Speak in a natural, conversational tone.
- Keep answers concise (2–3 sentences max), like a real interviewer.
- Encourage the candidate to think aloud.
- Adapt follow-up questions based on their last response.
- Be supportive but professional.
- If the candidate says "Thank you" , treat it as if the candidate is silent and prompt them to continue.


### Tasks:
1. For general questions:
   - Evaluate the candidate's response briefly (clarity, correctness, confidence).
   - If the answer is incomplete, politely nudge for more detail.
   - Ask the next technical question.

2. For coding questions:
   - Compare the candidate’s code with the reference solution if provided.
   - Judge correctness, efficiency, and style.
   - Suggest optimizations if needed.
   - If candidate requests a hint, give only a small clue.

3. Final feedback (at end of interview):
   - Summarize overall performance:
     1. Strengths demonstrated
     2. Areas for improvement
     3. Overall confidence level
     4. Recommendation (hire / no hire / needs more practice)

### Response Format:
Always reply in JSON:
{{
  "evaluation": "Brief feedback on the candidate's last response.",
  "next_question": "Your next question for the candidate.",
  "hint": "Optional hint if asked.",
  "final_feedback": "Only include this at the end."
}}
"""

def get_user_topics():
    print("Select interview topics (comma separated, e.g. DSA,DBMS):")
    print("Available topics:", ", ".join(TOPIC_OPTIONS))
    selected = input("Your choice(s): ").strip()
    chosen = [t.strip() for t in selected.split(",") if t.strip() in TOPIC_OPTIONS]
    if not chosen:
        print("No valid topics selected. Defaulting to all topics.")
        chosen = TOPIC_OPTIONS
    return chosen

def record_with_vad(filename="answer.wav"):
    print("Listening for speech...")
    vad = webrtcvad.Vad(3)  # Lower aggressiveness for better detection
    
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=SAMPLE_RATE,
                    input=True,
                    frames_per_buffer=FRAME_SIZE)
    
    frames = []
    silence_count = 0
    speech_started = False
    max_silence = 60  # ~1.8s of silence to stop
    
    try:
        while True:
            audio_chunk = stream.read(FRAME_SIZE, exception_on_overflow=False)
            is_speech = vad.is_speech(audio_chunk, SAMPLE_RATE)
            
            if is_speech:
                print("Speech detected")
                frames.append(audio_chunk)
                silence_count = 0
                speech_started = True
            else:
                print("Silence detected")
                silence_count += 1
                if speech_started:  # Only add silence frames after speech has started
                    frames.append(audio_chunk)
            
            # Stop recording after speech has started and enough silence is detected
            if speech_started and silence_count > max_silence:
                print("Silence threshold reached, stopping recording.")
                break
                
            # Safety break - don't record forever if no speech detected
            if not speech_started and silence_count > 200:
                print("No speech detected for too long, stopping.")
                break
                
    except KeyboardInterrupt:
        print("Recording stopped by user.")
    finally:
        stream.stop_stream()
        stream.close()
        p.terminate()
    
    if frames:
        # Concatenate all frames
        audio_data = b''.join(frames)
        # Convert to NumPy array for soundfile
        audio_np = np.frombuffer(audio_data, dtype=np.int16)
        sf.write(filename, audio_np, SAMPLE_RATE)
        return filename, True
    else:
        print("No audio recorded")
        # Create empty file
        sf.write(filename, np.array([]), SAMPLE_RATE)
        return filename, False