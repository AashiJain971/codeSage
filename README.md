# 🧠 CodeSage - AI-Powered Interview Platform

**Interviews Reimagined**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://codesage-5iht.onrender.com)
[![Backend API](https://img.shields.io/badge/API-Live-blue)](https://codesage-backend-1k6a.onrender.com)

A production-ready full-stack AI interview preparation platform featuring real-time voice-based technical and resume-based interviews, LLM-powered question generation, live transcription with WebRTC VAD, comprehensive performance analytics with interactive visualizations, and persistent data storage using Supabase PostgreSQL.

---

## 🌟 Core Features

### 🎤 Real-Time Voice-Based Interviews
- **WebSocket-powered communication** with bidirectional real-time data flow
- **WebRTC Voice Activity Detection (VAD)** for intelligent speech detection and automatic silence handling
- **Live audio transcription** using Groq Whisper Large V3 API with 30-second timeout handling
- **Text-to-Speech responses** via gTTS (Google Text-to-Speech) for natural AI interviewer voice
- **PyAudio + sounddevice integration** with 16kHz sampling rate and mono channel configuration
- **Adaptive audio chunking** (30ms frame duration) optimized for low-latency transcription
- **Automatic retry mechanisms** when no speech detected, with user-friendly prompts

### 💼 Technical Interview Mode
- **LLM-generated coding questions** using Groq Llama 3.3 70B model with dynamic difficulty adjustment
- **Multi-topic support**: Arrays, Strings, Linked Lists, Trees, Graphs, Dynamic Programming, Sorting, Searching, Hash Tables, Stacks & Queues
- **Live code editor** with syntax highlighting and multiple language support (Python, JavaScript, Java, C++)
- **Real-time approach discussion** - record and transcribe your problem-solving approach before coding
- **Intelligent hint system** with auto-hint every 60 seconds and manual hint requests
- **Code submission & evaluation** with AI-powered feedback on correctness, efficiency, and style
- **Question progression tracking** with visual indicators and completion status
- **Camera integration** for simulating real interview environment with video preview

### 📄 Resume-Based Interview Mode
- **PDF resume upload** with PyPDF2 text extraction and parsing
- **Personalized questions** generated from resume content (projects, skills, experience)
- **Behavioral interview simulation** with STAR method evaluation
- **Project deep-dive questions** targeting specific resume sections
- **Experience validation** through targeted technical and situational questions
- **Skill assessment** based on listed competencies and technologies

### 📊 Performance Analytics Dashboard
- **Interactive data visualizations** using custom SVG-based charts:
  - **Score Trend Chart**: Line chart with gradient area fill showing performance over time
  - **Topic Radar Chart**: Multi-axis radar visualization for topic-wise performance comparison
  - **Score Distribution Chart**: Bar chart displaying score ranges (0-20, 21-40, 41-60, 61-80, 81-100)
  - **Activity Heatmap**: Calendar-based heatmap showing interview frequency and intensity
- **Real-time statistics**: Total interviews, average scores, completion rates, time efficiency metrics
- **Performance insights** with AI-generated recommendations and improvement suggestions
- **Filter & sort capabilities**: Filter by status (approved/rejected/timeout/manually_ended), interview type, score range, date range
- **Trend analysis**: Improvement trajectory tracking with consistency scoring

### 📁 Data Management & Export
- **CSV export** with comprehensive interview data including questions, scores, feedback, timestamps
- **JSON export** for programmatic analysis and backup
- **Server-side filtering** for efficient large dataset handling (supports 1000+ interviews)
- **Pagination support** with configurable page size (1-100 records per page)
- **Streaming responses** for memory-efficient large file downloads

### 🎨 Modern UI/UX with Premium Animations
- **Framer Motion animations** throughout:
  - Fade-in/fade-out page transitions with stagger effects
  - Slide-up animations for feature cards
  - Spring physics for interactive elements (buttons, cards, modals)
  - AnimatePresence for smooth enter/exit transitions
- **Responsive design** optimized for all screen sizes:
  - Desktop: Full-featured layout with dual-panel interview interface
  - Tablet: Adaptive layouts with collapsible panels
  - Mobile: Hamburger navigation, touch-friendly controls, optimized chat interface
- **Typewriter intro animation** on landing page with cursor blinking effect (session-based, shows once per session)
- **Hero section** with floating animated cards showcasing AI Analysis, Smart Feedback, Performance Tracking
- **Neural network visualization** with animated brain outline and connection nodes
- **Gradient backgrounds** with purple-blue color scheme and smooth color transitions
- **Lucide React icons** for crisp, scalable iconography (100+ icons used)

### 💬 Interactive Chat Interface
- **Live transcript display** showing user responses and AI evaluations
- **Message timestamps** with user/AI/system differentiation
- **Auto-scrolling** to latest message with smooth scroll behavior
- **Typing indicators** during AI processing
- **Resizable chat panel** with drag handle for width adjustment
- **Chat history preservation** throughout interview session

### 📹 Camera & Audio Controls
- **Live video preview** with draggable, resizable camera window
- **Picture-in-Picture positioning** overlay on interview interface
- **Camera toggle** with smooth enable/disable transitions
- **Audio level monitoring** for microphone input validation
- **Device permission handling** with user-friendly error messages
- **Stream cleanup** on component unmount to prevent memory leaks

### 🔔 Session Management
- **Persistent sessions** stored in Supabase PostgreSQL database
- **Interview state tracking**: in_progress → completed/manually_ended/timeout
- **Duration calculation** in seconds with minute conversion for display
- **Completion method tracking**: automatic, manually_ended, timeout_cleanup
- **Resume association** linking uploaded PDFs to interview sessions
- **Question-response mapping** with foreign key constraints for data integrity

---

## 🛠️ Technology Stack

### Frontend Architecture
| Layer | Technologies |
|-------|-------------|
| **Framework** | Next.js 15.5 (App Router) with React 19.1 and TypeScript 5 |
| **Build System** | Next.js Turbopack for 10x faster builds |
| **Styling** | Tailwind CSS 4.0 with PostCSS processing |
| **Animations** | Framer Motion 12.23 (spring physics, gestures, layout animations) |
| **Icons** | Lucide React 0.544 (tree-shakeable icon library) |
| **State Management** | React hooks (useState, useEffect, useRef, useMemo, useCallback) |
| **Real-Time Communication** | Native WebSocket API with reconnection logic |
| **Audio Processing** | Web Audio API, MediaRecorder API, MediaStream API |
| **HTTP Client** | Native Fetch API with async/await patterns |

### Backend Architecture
| Component | Technology |
|-----------|-----------|
| **API Framework** | FastAPI 0.109 (Python 3.8+) with Pydantic 2.x validation |
| **ASGI Server** | Uvicorn 0.27 with standard websockets support |
| **WebSocket Protocol** | WebSockets 13.0+ with async handlers |
| **LLM Integration** | Groq API (Llama 3.3 70B Versatile, Llama 3.1 8B Instant) |
| **Speech Recognition** | Groq Whisper Large V3 via REST API |
| **Voice Activity Detection** | WebRTC VAD 2.0 with aggressiveness level 1 |
| **Audio Processing** | PyAudio 0.2.14, sounddevice 0.4.6, soundfile 0.12, numpy 1.26 |
| **Text-to-Speech** | gTTS 2.5 (Google Text-to-Speech) |
| **PDF Processing** | PyPDF2 3.0 for resume text extraction |
| **Database** | Supabase 2.10 (PostgreSQL client) with REST API |
| **HTTP Client** | httpx 0.27 for external API calls |
| **File Handling** | aiofiles 23.2 for async file operations |
| **Security** | cryptography 42.0 for secure data handling |
| **Configuration** | python-dotenv 1.0 for environment management |

### Database Architecture
| Service | Platform & Details |
|---------|-------------------|
| **Database** | Supabase (PostgreSQL 15+) with Row Level Security |
| **Schema Design** | 2 tables: `interviews`, `question_responses` |
| **Primary Keys** | UUID with auto-generation via `gen_random_uuid()` |
| **Foreign Keys** | CASCADE delete for referential integrity |
| **Indexes** | session_id, status, completion_method, created_at (descending) |
| **JSONB Storage** | final_results column for flexible schema evolution |
| **Array Types** | topics[], individual_scores[] for efficient storage |
| **Timestamps** | TIMESTAMPTZ (timezone-aware) with NOW() defaults |

### Deployment & DevOps
| Service | Platform & Details |
|---------|-------------------|
| **Frontend Hosting** | Render (Node.js 20+ environment, automatic HTTPS) |
| **Backend Hosting** | Render (Python 3.8+ environment, health check monitoring) |
| **Build Commands** | Frontend: `npm install && npm run build --turbopack` |
| **Start Commands** | Frontend: `npm start`, Backend: `uvicorn ws_server:app --host 0.0.0.0 --port $PORT` |
| **CORS Configuration** | FastAPI middleware allowing localhost and production domains |
| **Environment Variables** | Render dashboard for production, `.env` files for local development |
| **Version Control** | Git with automatic deployment on push to main branch |
| **Health Monitoring** | `/health` endpoint returning service status, database connectivity, API availability |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js 20+** with npm (for frontend development)
- **Python 3.8+** with pip (for backend development)
- **Groq API Key** ([Get free API key](https://console.groq.com))
- **Supabase Account** ([Create free account](https://supabase.com))
- **Git** for version control

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/codeSageNew.git
cd codeSageNew/frontend

# Install dependencies
npm install

# Create environment configuration
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://codesage-backend-1k6a.onrender.com
NEXT_PUBLIC_WS_URL=wss://codesage-backend-1k6a.onrender.com
EOF

# For local development
cat > .env.development.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
EOF

# Start development server
npm run dev
```

**Frontend runs at**: http://localhost:3000

### Backend Setup

```bash
# Navigate to backend directory
cd ../backend

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create environment configuration
cat > .env << EOF
GROQ_API_KEY=your_groq_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
EOF

# Initialize database tables
# 1. Go to Supabase Dashboard > SQL Editor
# 2. Copy contents of SUPABASE_SCHEMA.sql
# 3. Paste and run in SQL editor

# Verify database setup
python3 verify_database.py

# Start backend server
uvicorn ws_server:app --host 127.0.0.1 --port 8000 --reload
```

**Backend runs at**: http://localhost:8000  
**API Documentation**: http://localhost:8000/docs (auto-generated FastAPI Swagger UI)  
**WebSocket Endpoint**: ws://localhost:8000/ws

### Database Setup (Supabase)

1. **Create Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project
2. **Get Credentials**: Copy your project URL and anon key from Settings > API
3. **Run Schema**: Navigate to SQL Editor and execute SUPABASE_SCHEMA.sql
4. **Verify Tables**: Check that `interviews` and `question_responses` tables were created

---

## 📁 Project Structure

```
codeSageNew/
├── frontend/
│   ├── src/
│   │   ├── app/                              # Next.js App Router pages
│   │   │   ├── page.tsx                      # Landing page with typewriter intro
│   │   │   ├── layout.tsx                    # Root layout with metadata
│   │   │   ├── globals.css                   # Global styles + Tailwind directives
│   │   │   ├── home.css                      # Landing page styles
│   │   │   ├── interview/
│   │   │   │   ├── page.tsx                  # Interview type selection
│   │   │   │   ├── technical/
│   │   │   │   │   └── page.tsx              # Technical interview interface (1648 lines)
│   │   │   │   ├── resume/
│   │   │   │   │   └── page.tsx              # Resume-based interview (2375 lines)
│   │   │   │   └── results/
│   │   │   │       └── page.tsx              # Interview results display
│   │   │   ├── past-interviews/
│   │   │   │   └── page.tsx                  # Analytics dashboard (736 lines)
│   │   │   └── api/
│   │   │       └── interviews/
│   │   │           └── route.ts              # API route proxying to backend
│   │   ├── components/
│   │   │   ├── Navbar.tsx                    # Navigation with mobile menu
│   │   │   ├── Hero.tsx                      # Hero section with animations
│   │   │   ├── Features.tsx                  # Feature cards section
│   │   │   ├── TypewriterIntro.tsx           # Animated intro sequence
│   │   │   ├── charts/
│   │   │   │   ├── ScoreTrendChart.tsx       # SVG line chart (200 lines)
│   │   │   │   ├── TopicRadarChart.tsx       # Radar chart visualization
│   │   │   │   ├── ScoreDistributionChart.tsx # Bar chart for scores
│   │   │   │   └── ActivityHeatmap.tsx       # Calendar heatmap
│   │   │   └── analytics/
│   │   │       └── PerformanceInsightsPanel.tsx  # AI insights display
│   │   ├── types/
│   │   │   └── interview.ts                  # TypeScript interfaces
│   │   └── utils/
│   │       └── interviewUtils.ts             # Helper functions
│   ├── public/
│   │   └── favicon.ico
│   ├── package.json                          # Dependencies
│   ├── tsconfig.json                         # TypeScript config
│   ├── tailwind.config.ts                    # Tailwind configuration
│   ├── next.config.ts                        # Next.js configuration
│   ├── postcss.config.mjs                    # PostCSS plugins
│   ├── eslint.config.mjs                     # ESLint rules
│   ├── Dockerfile                            # Container config
│   └── .env.production                       # Production environment vars
│
├── backend/
│   ├── ws_server.py                          # Main FastAPI WebSocket server (2136 lines)
│   ├── api.py                                # REST API endpoints (470 lines)
│   ├── database.py                           # Supabase operations (467 lines)
│   ├── interview.py                          # Technical interview logic (272 lines)
│   ├── interview_with_resume.py              # Resume interview logic
│   ├── utils.py                              # Helper functions (168 lines)
│   ├── verify_database.py                    # Database verification script
│   ├── SUPABASE_SCHEMA.sql                   # Database schema (231 lines)
│   ├── requirements.txt                      # Python dependencies
│   ├── Dockerfile                            # Container config
│   ├── .env                                  # Environment variables (gitignored)
│   └── interview_results/                    # Cached interview JSON files
│
├── .gitignore
└── README.md                                 # This file
```

---

## 🔌 API Reference

### Core REST Endpoints

| Endpoint | Method | Description | Response Time |
|----------|--------|-------------|---------------|
| `/health` | GET | Health check with service status | ~20ms |
| `/api/interviews` | GET | Paginated interview list with filters | ~50ms |
| `/api/interviews/stats/overview` | GET | Overall statistics (total, approved, rejected, avg score) | ~40ms |
| `/api/interviews/analytics/performance` | GET | Topic performance, score distribution, time efficiency | ~80ms |
| `/api/interviews/analytics/insights` | GET | AI-generated insights and recommendations | ~100ms |
| `/api/interviews/export` | GET | Export interviews as CSV or JSON | ~200ms |
| `/api/interviews/{id}` | GET | Single interview details | ~30ms |

### WebSocket Endpoints

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/ws/technical` | WebSocket | Technical interview session with LLM questions |
| `/ws` | WebSocket | Resume-based interview session |

### Example: Technical Interview WebSocket Flow

```typescript
// Connect to WebSocket
const ws = new WebSocket('wss://codesage-backend-1k6a.onrender.com/ws/technical');

// 1. Initialize interview
ws.send(JSON.stringify({
  type: 'start_interview',
  topics: ['Arrays', 'Dynamic Programming', 'Trees']
}));

// 2. Server responds with first question
{
  type: 'question',
  message: 'Let's start with a coding problem...',
  next_question: 'Given an array of integers, find two numbers that add up to a target sum.',
  difficulty: 'medium',
  question_number: 1,
  remaining_questions: 4
}

// 3. User discusses approach (audio recorded, transcribed, sent as base64)
ws.send(JSON.stringify({
  type: 'approach_audio',
  audio_data: 'base64_encoded_audio_blob',
  mime_type: 'audio/webm;codecs=opus'
}));

// 4. Server evaluates approach
{
  type: 'approach_feedback',
  evaluation: 'Good start! You correctly identified using a hash map...',
  hint: 'Consider the space-time tradeoff...'
}

// 5. User submits code
ws.send(JSON.stringify({
  type: 'submit_code',
  code: 'def two_sum(nums, target):\n    seen = {}\n    ...',
  language: 'python'
}));

// 6. Server evaluates code
{
  type: 'code_evaluation',
  code_feedback: 'Excellent implementation! Time complexity O(n), Space O(n).',
  score: 95,
  question_complete: true
}

// 7. End interview
ws.send(JSON.stringify({ type: 'end_interview' }));

// 8. Server returns final results
{
  type: 'interview_complete',
  results: {
    session_id: 'abc123-def456',
    average_score: 87,
    total_questions: 5,
    completed_questions: 5,
    topics: ['Arrays', 'Dynamic Programming', 'Trees'],
    download_url: '/api/interviews/abc123-def456/download'
  }
}
```

### Example: Analytics API Response

```json
// GET /api/interviews/analytics/performance
{
  "topic_performance": [
    {
      "topic": "Arrays",
      "average_score": 85,
      "attempts": 12,
      "max_score": 98,
      "min_score": 65
    },
    {
      "topic": "Dynamic Programming",
      "average_score": 72,
      "attempts": 8,
      "max_score": 90,
      "min_score": 45
    }
  ],
  "score_distribution": {
    "0-20": 0,
    "21-40": 2,
    "41-60": 5,
    "61-80": 8,
    "81-100": 10
  },
  "time_efficiency": {
    "average": 1.45,
    "by_interview": {
      "session_1": 1.32,
      "session_2": 1.58
    }
  },
  "improvement_trend": [
    { "date": "2025-12-15T10:30:00Z", "score": 65, "interview_number": 1 },
    { "date": "2025-12-16T14:20:00Z", "score": 78, "interview_number": 2 },
    { "date": "2025-12-17T09:15:00Z", "score": 85, "interview_number": 3 }
  ],
  "consistency_score": 82
}
```

---

## 📊 Data Models

### Core TypeScript Interfaces

```typescript
// Complete interview data structure
interface Interview {
  id: string;                          // UUID from database
  type: 'technical' | 'resume';        // Interview mode
  date: string;                        // ISO 8601 timestamp
  duration: number;                    // Minutes
  duration_seconds: number;            // Seconds (backend tracking)
  score: number;                       // 0-100 average score
  status: 'approved' | 'rejected' | 'manually_ended' | 'timeout' | 'in_progress';
  topics: string[];                    // Selected interview topics
  questions_completed: number;         // Number of answered questions
  total_questions: number;             // Expected question count
  interviewer: string;                 // AI interviewer identifier
  feedback: string;                    // Overall performance feedback
  completion_method: 'automatic' | 'manually_ended' | 'timeout_cleanup';
  individual_scores: number[];         // Per-question scores
  start_time: string;                  // Session start timestamp
  end_time: string | null;             // Session end timestamp
  final_results: any;                  // Complete interview results object
}

// Question response tracking
interface QuestionResponse {
  id: string;
  session_id: string;
  question_index: number;
  question_text: string;
  user_response: string | null;
  code_submission: string | null;
  score: number | null;                // 0-100 for this question
  feedback: string | null;
  time_taken: number | null;           // Seconds
  hints_used: number;
  difficulty: 'easy' | 'medium' | 'hard';
  created_at: string;
  updated_at: string;
}

// Performance analytics aggregation
interface PerformanceAnalytics {
  topic_performance: {
    topic: string;
    average_score: number;
    attempts: number;
    max_score: number;
    min_score: number;
  }[];
  score_distribution: {
    '0-20': number;
    '21-40': number;
    '41-60': number;
    '61-80': number;
    '81-100': number;
  };
  time_efficiency: {
    average: number;
    by_interview: { [key: string]: number };
  };
  improvement_trend: {
    date: string;
    score: number;
    interview_number: number;
  }[];
  consistency_score: number;           // 0-100, higher = more consistent
}

// AI-generated performance insights
interface PerformanceInsights {
  strengths: string[];                 // Top performing areas
  weaknesses: string[];                // Areas needing improvement
  recommendations: string[];           // Actionable suggestions
  overall_trend: 'improving' | 'stable' | 'declining';
  focus_topics: string[];              // Topics to practice
}

// Filter configuration
interface FilterOptions {
  status: 'all' | 'approved' | 'rejected' | 'manually_ended' | 'timeout';
  interviewType: 'all' | 'technical' | 'resume';
  scoreRange: { min: number; max: number };
  dateRange: { start: string | null; end: string | null };
  topics: string[];
  searchQuery: string;
}
```

---

## 🎯 Key Implementation Details

### 1. Real-Time Voice Processing Pipeline

**Audio Capture → VAD → Transcription → LLM Processing → TTS → Playback**

```python
# backend/utils.py - Voice Activity Detection
def record_with_vad(filename="answer.wav"):
    vad = webrtcvad.Vad(1)  # Aggressiveness level 1 (0-3)
    p = pyaudio.PyAudio()
    
    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=16000,
        input=True,
        frames_per_buffer=int(16000 * 0.030)  # 30ms chunks
    )
    
    frames = []
    speech_frames = 0
    silence_frames = 0
    is_speaking = False
    
    while True:
        chunk = stream.read(480)  # 30ms at 16kHz
        is_speech = vad.is_speech(chunk, 16000)
        
        if is_speech:
            speech_frames += 1
            silence_frames = 0
            if speech_frames > 10:  # 300ms of speech
                is_speaking = True
            frames.append(chunk)
        else:
            silence_frames += 1
            if is_speaking and silence_frames > 30:  # 900ms silence
                break
    
    # Save as WAV file
    wf = wave.open(filename, 'wb')
    wf.setnchannels(1)
    wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
    wf.setframerate(16000)
    wf.writeframes(b''.join(frames))
    wf.close()
    
    return filename, len(frames) > 0
```

### 2. LLM-Powered Question Generation

```python
# backend/ws_server.py - Dynamic Question Generation
def generate_technical_question(topics: List[str], difficulty: str = "medium") -> dict:
    prompt = f"""
You are a senior technical interviewer. Generate a coding interview question as JSON.

Topics: {", ".join(topics)}
Difficulty: {difficulty}

Format (no markdown, pure JSON):
{{
    "question": "Clear problem description with examples",
    "difficulty": "{difficulty}",
    "topics": {json.dumps(topics)},
    "hints": ["Hint 1", "Hint 2", "Hint 3"],
    "test_cases": [
        {{"input": "sample", "output": "expected", "explanation": "why"}}
    ],
    "evaluation_criteria": ["Correctness", "Efficiency", "Edge cases"]
}}
"""
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=800
    )
    
    # Parse and validate JSON response
    json_str = extract_json_from_response(response.choices[0].message.content)
    question_data = json.loads(repair_json_string(json_str))
    
    return question_data
```

### 3. WebSocket Session Management

```python
# backend/ws_server.py - Interview Session Handler
@app.websocket("/ws/technical")
async def technical_ws_endpoint(ws: WebSocket):
    await ws.accept()
    session = {
        "session_id": str(uuid.uuid4()),
        "mode": "technical",
        "topics": [],
        "questions": [],
        "current_question": 0,
        "scores": [],
        "start_time": None,
        "interviewer_messages": [],
        "user_responses": []
    }
    
    try:
        while True:
            data = await ws.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "start_interview":
                session["topics"] = message.get("topics", [])
                session["start_time"] = datetime.now()
                
                # Generate first question
                question = generate_technical_question(session["topics"])
                session["questions"].append(question)
                
                await ws.send_json({
                    "type": "question",
                    "message": f"Let's start your {', '.join(session['topics'])} interview!",
                    "next_question": question["question"],
                    "difficulty": question["difficulty"],
                    "question_number": 1
                })
            
            elif msg_type == "approach_audio":
                # Decode base64 audio, save, transcribe
                audio_data = base64.b64decode(message["audio_data"])
                audio_path = f"approach_{session['session_id']}_{len(session['user_responses'])}.wav"
                
                with open(audio_path, "wb") as f:
                    f.write(audio_data)
                
                transcript = transcribe(audio_path)
                session["user_responses"].append(transcript)
                
                # Evaluate approach using LLM
                evaluation = evaluate_approach(transcript, session["questions"][session["current_question"]])
                
                await ws.send_json({
                    "type": "approach_feedback",
                    "transcript": transcript,
                    "evaluation": evaluation["feedback"],
                    "hint": evaluation.get("hint", "")
                })
            
            elif msg_type == "submit_code":
                # Evaluate code submission
                code_eval = evaluate_code(
                    message["code"],
                    message["language"],
                    session["questions"][session["current_question"]]
                )
                
                session["scores"].append(code_eval["score"])
                
                await ws.send_json({
                    "type": "code_evaluation",
                    "code_feedback": code_eval["feedback"],
                    "score": code_eval["score"],
                    "question_complete": True
                })
                
                # Move to next question or end interview
                session["current_question"] += 1
                if session["current_question"] < 5:  # 5 questions total
                    next_q = generate_technical_question(session["topics"])
                    session["questions"].append(next_q)
                    await ws.send_json({
                        "type": "question",
                        "next_question": next_q["question"],
                        "question_number": session["current_question"] + 1
                    })
                else:
                    # Interview complete
                    await save_interview_results(session)
                    await ws.send_json({
                        "type": "interview_complete",
                        "results": calculate_final_results(session)
                    })
    
    except WebSocketDisconnect:
        # Save partial interview
        await save_interview_results(session, completion_method="timeout_cleanup")
```

### 4. Supabase Database Operations

```python
# backend/database.py - Interview Storage
class DatabaseOperations:
    def __init__(self, supabase_client):
        self.client = supabase_client
    
    async def create_interview(self, session_data: dict) -> dict:
        """Create new interview session"""
        interview = {
            "session_id": session_data["session_id"],
            "interview_type": session_data["mode"],
            "topics": session_data["topics"],
            "total_questions": len(session_data["questions"]),
            "status": "in_progress",
            "start_time": session_data["start_time"].isoformat()
        }
        
        result = self.client.table("interviews").insert(interview).execute()
        return result.data[0]
    
    async def save_question_response(self, session_id: str, question_data: dict):
        """Save individual question response"""
        response = {
            "session_id": session_id,
            "question_index": question_data["index"],
            "question_text": question_data["question"],
            "user_response": question_data.get("user_response"),
            "code_submission": question_data.get("code"),
            "score": question_data.get("score"),
            "feedback": question_data.get("feedback"),
            "time_taken": question_data.get("time_taken"),
            "hints_used": question_data.get("hints_used", 0),
            "difficulty": question_data.get("difficulty", "medium")
        }
        
        self.client.table("question_responses").insert(response).execute()
    
    async def complete_interview(self, session_id: str, results: dict):
        """Mark interview as complete with final results"""
        update_data = {
            "status": "completed",
            "end_time": datetime.now().isoformat(),
            "completed_questions": results["completed"],
            "average_score": results["average_score"],
            "individual_scores": results["scores"],
            "final_results": results,
            "completion_method": results.get("completion_method", "automatic"),
            "duration": results.get("duration_seconds", 0)
        }
        
        self.client.table("interviews")\
            .update(update_data)\
            .eq("session_id", session_id)\
            .execute()
```

### 5. Frontend WebSocket Integration

```typescript
// frontend/src/app/interview/technical/page.tsx
const connectWebSocket = async (topics: string[]) => {
  if (wsRef.current?.readyState === WebSocket.OPEN) return;
  
  setIsConnecting(true);
  
  try {
    const ws = new WebSocket(`${WS_BASE}/ws/technical`);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start interview
      ws.send(JSON.stringify({
        type: 'start_interview',
        topics: topics
      }));
    };
    
    ws.onmessage = (event) => {
      const data: WebSocketMessage = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      addChatMessage('system', 'Connection error. Please try again.');
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket closed');
      setIsConnected(false);
    };
    
    wsRef.current = ws;
  } catch (error) {
    console.error('Failed to connect:', error);
    setIsConnecting(false);
  }
};

const handleWebSocketMessage = (data: WebSocketMessage) => {
  switch (data.type) {
    case 'question':
      setCurrentQuestion(data.next_question || '');
      addChatMessage('ai', data.message || '');
      setQuestionStartTime(Date.now());
      break;
    
    case 'approach_feedback':
      setTranscript(data.transcript || '');
      addChatMessage('ai', data.evaluation || '');
      if (data.hint) {
        addChatMessage('system', `💡 Hint: ${data.hint}`);
      }
      break;
    
    case 'code_evaluation':
      addChatMessage('ai', data.code_feedback || '');
      if (data.score) {
        addChatMessage('system', `Score: ${data.score}/100`);
      }
      break;
    
    case 'interview_complete':
      setInterviewResults(data.results);
      setShowResults(true);
      setInterviewCompleted(true);
      // Close WebSocket after completion
      setTimeout(() => wsRef.current?.close(), 1000);
      break;
  }
};
```

### 6. Custom SVG Charts Implementation

```typescript
// frontend/src/components/charts/ScoreTrendChart.tsx
export default function ScoreTrendChart({ data }: { data: any[] }) {
  const chartWidth = 600;
  const chartHeight = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  
  // Calculate scales
  const maxScore = 100;
  const xScale = (index: number) => 
    padding.left + (index / (data.length - 1)) * innerWidth;
  const yScale = (score: number) => 
    chartHeight - padding.bottom - (score / maxScore) * innerHeight;
  
  // Generate path data
  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(d.score)
  }));
  
  const pathData = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`)
    .join(' ');
  
  // Area gradient fill
  const areaData = `${pathData} L ${points[points.length - 1].x},${chartHeight - padding.bottom} L ${padding.left},${chartHeight - padding.bottom} Z`;
  
  return (
    <svg width={chartWidth} height={chartHeight} className="w-full h-auto">
      <defs>
        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(score => (
        <line
          key={score}
          x1={padding.left}
          x2={chartWidth - padding.right}
          y1={yScale(score)}
          y2={yScale(score)}
          stroke="#e5e7eb"
          strokeDasharray="4"
        />
      ))}
      
      {/* Area fill */}
      <path d={areaData} fill="url(#scoreGradient)" />
      
      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke="#8b5cf6"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Data points */}
      {points.map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r="5"
          fill="#8b5cf6"
          stroke="white"
          strokeWidth="2"
        />
      ))}
      
      {/* Y-axis labels */}
      {[0, 25, 50, 75, 100].map(score => (
        <text
          key={score}
          x={padding.left - 10}
          y={yScale(score) + 4}
          textAnchor="end"
          fontSize="12"
          fill="#6b7280"
        >
          {score}
        </text>
      ))}
    </svg>
  );
}
```

---

## 📦 Deployment Guide

### Development Environment

```bash
# Frontend (Next.js with Turbopack)
cd frontend
npm run dev          # http://localhost:3000

# Backend (FastAPI with Uvicorn)
cd backend
python3 ws_server.py # http://localhost:8000
```

### Production Deployment on Render

#### Frontend Configuration
- **Service Type**: Web Service
- **Build Command**: `npm install && npm run build --turbopack`
- **Start Command**: `npm start`
- **Environment Variables**:
  ```
  NEXT_PUBLIC_API_URL=https://codesage-backend-1k6a.onrender.com
  NEXT_PUBLIC_WS_URL=wss://codesage-backend-1k6a.onrender.com
  ```
- **⚠️ Important**: Environment variables are **baked into the build**. You must **rebuild** after changing env vars (not just restart).

#### Backend Configuration
- **Service Type**: Web Service
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn ws_server:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  ```
  GROQ_API_KEY=your_groq_api_key
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_ANON_KEY=your_anon_key
  ```
- **Health Check Path**: `/health`
- **Port**: Auto-assigned by Render (use `$PORT` variable)

#### Database Configuration (Supabase)
- **Project Setup**: Create project at [supabase.com](https://supabase.com)
- **SQL Schema**: Run SUPABASE_SCHEMA.sql in SQL Editor
- **Tables Created**: `interviews`, `question_responses`
- **RLS Policies**: Disabled for service role access (backend authenticates with anon key)

### Environment Variables Reference

#### Frontend (`.env.production`)
```env
NEXT_PUBLIC_API_URL=https://codesage-backend-1k6a.onrender.com
NEXT_PUBLIC_WS_URL=wss://codesage-backend-1k6a.onrender.com
```

#### Frontend (`.env.development.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

#### Backend (`.env`)
```env
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

---

## 🎓 Skills & Concepts Demonstrated

### Advanced Frontend Engineering
- ✅ **Next.js 15 App Router** with Turbopack for 10x faster builds
- ✅ **React 19** with modern hooks (useState, useEffect, useRef, useMemo, useCallback)
- ✅ **TypeScript 5** with strict type checking and custom interfaces
- ✅ **Real-time WebSocket communication** with native WebSocket API
- ✅ **Framer Motion animations** with spring physics and layout animations
- ✅ **Responsive design** with Tailwind CSS 4.0 and mobile-first approach
- ✅ **Custom SVG charts** with interactive data visualizations
- ✅ **Media API integration** (MediaRecorder, MediaStream, getUserMedia)
- ✅ **Audio processing** with Web Audio API for real-time recording
- ✅ **Performance optimization** with code splitting and lazy loading

### Backend & Systems Design
- ✅ **FastAPI mastery** with WebSocket protocol and async handlers
- ✅ **Python asyncio** for concurrent request handling
- ✅ **LLM integration** with Groq API (Llama 3.3 70B, Llama 3.1 8B)
- ✅ **Speech-to-text** with Groq Whisper Large V3
- ✅ **Voice Activity Detection** using WebRTC VAD algorithm
- ✅ **Audio signal processing** with PyAudio, sounddevice, numpy
- ✅ **Database design** with PostgreSQL (Supabase) and proper normalization
- ✅ **RESTful API design** with pagination, filtering, and server-side processing
- ✅ **File handling** with PDF text extraction (PyPDF2) and async I/O (aiofiles)

### AI/ML Integration
- ✅ **Large Language Models** for question generation and evaluation
- ✅ **Prompt engineering** with structured JSON outputs and validation
- ✅ **Automatic Speech Recognition** with retry mechanisms and error handling
- ✅ **Text-to-Speech synthesis** for natural conversation flow
- ✅ **AI-powered analytics** with performance insights and recommendations

### DevOps & Deployment
- ✅ **Cloud deployment** on Render platform (frontend + backend)
- ✅ **Environment configuration** with proper separation of dev/prod settings
- ✅ **CORS handling** for secure cross-origin requests
- ✅ **Health check monitoring** with service status endpoints
- ✅ **Database migration** with SQL schema versioning
- ✅ **Error tracking** with comprehensive logging and graceful degradation

### UI/UX Design
- ✅ **Component-driven architecture** with reusable React components
- ✅ **Accessibility** (ARIA labels, keyboard navigation, screen reader support)
- ✅ **Visual hierarchy** and information architecture
- ✅ **Micro-animations** for enhanced user feedback
- ✅ **Data visualization** with custom SVG charts
- ✅ **Responsive layouts** with breakpoint-based design

---

## 🔮 Future Roadmap

### Short-term Enhancements
- [ ] **Real-time collaborative interviews** with multiple participants and screen sharing
- [ ] **Video recording** with playback and downloadable interview recordings
- [ ] **Speech recognition improvements** with custom wake word detection
- [ ] **Code execution environment** with sandboxed Docker containers for testing solutions
- [ ] **Mobile native apps** (React Native for iOS/Android)
- [ ] **Offline mode** with IndexedDB caching for interrupted sessions

### Long-term Vision
- [ ] **Multi-language support** (Spanish, French, German, Hindi, Mandarin)
- [ ] **Interview scheduling** with calendar integration and email reminders
- [ ] **Peer practice mode** connecting users for mock interviews
- [ ] **Company-specific prep** with real interview questions from top tech companies
- [ ] **Whiteboard integration** for system design and diagramming
- [ ] **Sentiment analysis** detecting stress levels and providing encouragement
- [ ] **Gamification** with achievement badges, leaderboards, and progress streaks
- [ ] **AR/VR support** for immersive interview simulation

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started
1. **Fork the repository** on GitHub
2. **Clone your fork**: `git clone https://github.com/yourusername/codeSageNew.git`
3. **Create a feature branch**: `git checkout -b feature/amazing-feature`
4. **Make your changes** with clear, descriptive commits
5. **Push to your fork**: `git push origin feature/amazing-feature`
6. **Open a Pull Request** with detailed description

### Code Style
- **Frontend**: Follow ESLint rules (`npm run lint`), use Prettier for formatting
- **Backend**: Follow PEP 8 Python style guide, use Black for formatting
- **TypeScript**: Use strict mode, avoid `any` types, prefer interfaces over types
- **Commit messages**: Use conventional commits format (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Comments**: JSDoc for TypeScript functions, docstrings for Python

### Testing Guidelines
- Test WebSocket connections on localhost before deploying
- Verify audio recording and transcription with different microphones
- Check responsive design on mobile/tablet/desktop
- Test API endpoints with Postman or Thunder Client
- Verify database operations with Supabase dashboard

---

## 📄 License
© 2025 Aashi Jain
