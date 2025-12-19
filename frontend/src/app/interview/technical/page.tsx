"use client";

import { motion, AnimatePresence } from "framer-motion";
import Navbar from '../../../components/Navbar';
import {
  Code2,
  Mic,
  CheckCircle,
  Loader2,
  Play,
  ArrowLeft,
  MessageSquare,
  Bot,
  User,
  Zap,
  Activity,
  Send,
  Camera,
  CameraOff,
  PlayCircle,
  Square,
  Monitor,
  Volume2,
  VolumeX,
  Settings,
  Maximize2,
  Terminal,
  Eye,
  Brain,
  Cpu,
  X,
  Trophy,
  MessageSquareText,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface WebSocketMessage {
  type: string;
  message?: string;
  next_question?: string;
  evaluation?: string;
  hint?: string;
  final_feedback?: string;
  transcript?: string;
  error?: string;
  topics?: string[];
  interview_id?: string;
  session_id?: string;
  download_url?: string;
  code_feedback?: string;
  question_complete?: boolean;
  score?: number;
  difficulty?: string;
  results?: any;
  feedback?: string;
  question_number?: number;
  remaining_questions?: number;
}

interface Question {
  id: number;
  question: string;
  code: string;
  score: number;
  timeSpent: number;
  hintsUsed: number;
  completed: boolean;
}

interface ChatMessage {
  id: string;
  type: "user" | "ai" | "system";
  content: string;
  timestamp: Date;
}

// Resolve API/WS endpoints even if env vars are missing at build time
const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://codesage-backend-1k6a.onrender.com";
};

const getWsBase = () => {
  if (process.env.NEXT_PUBLIC_WS_URL && process.env.NEXT_PUBLIC_WS_URL !== "undefined") {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin.replace(/^http/, "ws");
  }
  return "wss://codesage-backend-1k6a.onrender.com";
};

export default function TechnicalInterview() {
  const router = useRouter();

  const handleTakeInterview = () => {
    router.push("/interview");
  };

  const handleViewResults = () => {
    router.push("/interview/results");
  };

  const handleGoHome = () => {
    router.push("/");
  };
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [approachDiscussed, setApproachDiscussed] = useState(false);
  const [hintTimer, setHintTimer] = useState<NodeJS.Timeout | null>(null);
  const [autoHintEnabled, setAutoHintEnabled] = useState(true); // Enable auto hints
  const [isRecordingApproach, setIsRecordingApproach] = useState(false);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [interviewResults, setInterviewResults] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [chatOpened, setChatOpened] = useState(false);

  const [speechInitialized, setSpeechInitialized] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const AVAILABLE_TOPICS = [
    "Arrays",
    "Strings",
    "Linked Lists",
    "Trees",
    "Graphs",
    "Dynamic Programming",
    "Sorting",
    "Searching",
    "Hash Tables",
    "Stacks & Queues",
  ];

  const addChatMessage = (type: "user" | "ai" | "system", content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, newMessage]);

    // Auto-scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Initialize camera
  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        cameraStreamRef.current = stream;
        setCameraEnabled(true);
      }
    } catch (error) {
      console.error("Camera initialization failed:", error);
      addChatMessage("system", "Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      setCameraEnabled(false);
    }
  };

  useEffect(() => {
    initializeCamera();
    return () => stopCamera();
  }, []);

  // Auto hint timer - gives hint every 60 seconds for better user experience
  useEffect(() => {
    if (interviewStarted && autoHintEnabled && currentQuestion) {
      if (hintTimer) clearTimeout(hintTimer);

      const timer = setTimeout(() => {
        requestHint();
      }, 60000); // Increased from 15000 to 60000 (60 seconds)

      setHintTimer(timer);
    }
  }, [currentQuestion, interviewStarted, autoHintEnabled]);

  const requestHint = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Reset hint timer when user manually requests hint
    if (hintTimer) {
      clearTimeout(hintTimer);
      setHintTimer(null);
    }

    setHintsUsed((prev) => prev + 1);
    wsRef.current.send(
      JSON.stringify({
        type: "request_hint",
        question: currentQuestion,
        code: code,
        language: language,
      })
    );
  };

  const discussApproach = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addChatMessage("system", "WebSocket connection not available");
      return;
    }

    // Reset hint timer when user starts approach discussion
    if (hintTimer) {
      clearTimeout(hintTimer);
      setHintTimer(null);
    }

    addChatMessage("system", "Starting approach discussion...");
    wsRef.current.send(
      JSON.stringify({
        type: "record_audio",
        question: currentQuestion,
      })
    );
    setIsRecordingApproach(true);
  };

  const stopApproachDiscussion = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addChatMessage("system", "WebSocket connection not available");
      return;
    }

    addChatMessage("system", "Stopping approach discussion...");
    wsRef.current.send(
      JSON.stringify({
        type: "stop_recording",
      })
    );
    setIsRecordingApproach(false);
  };

  const submitCode = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Immediately stop any ongoing speech
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
    }

    const timeSpent = Date.now() - questionStartTime;

    wsRef.current.send(
      JSON.stringify({
        type: "submit_code",
        question: currentQuestion,
        code: code,
        language: language,
        time_spent: timeSpent,
        hints_used: hintsUsed,
        approach_discussed: approachDiscussed,
      })
    );

    addChatMessage("user", `Submitted ${language} solution`);
  };

  const getLanguageTemplate = (lang: string): string => {
    const templates = {
      python:
        '# Write your solution here\ndef solution():\n    pass\n\n# Test your code\nif __name__ == "__main__":\n    result = solution()\n    print(result)',
      javascript:
        "// Write your solution here\nfunction solution() {\n    // Your code here\n}\n\n// Test your code\nconsole.log(solution());",
      java: "public class Solution {\n    public static void main(String[] args) {\n        Solution sol = new Solution();\n        // Test your solution\n    }\n    \n    // Write your solution here\n    public void solution() {\n        \n    }\n}",
      cpp: "#include <iostream>\n#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    // Write your solution here\n    void solution() {\n        \n    }\n};\n\nint main() {\n    Solution sol;\n    // Test your solution\n    return 0;\n}",
    };
    return templates[lang as keyof typeof templates] || templates.python;
  };

  const initializeSpeech = () => {
    if (!speechInitialized) {
      console.log("Initializing speech synthesis...");
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          // Create a silent utterance to initialize speech synthesis
          const silentUtterance = new SpeechSynthesisUtterance("");
          silentUtterance.volume = 0;
          window.speechSynthesis.speak(silentUtterance);
          setSpeechInitialized(true);
          console.log("Speech synthesis initialized");
        } catch (e) {
          console.warn('Speech synthesis initialization failed', e);
          // Mark initialized to avoid repeated failures
          setSpeechInitialized(true);
        }
      } else {
        console.warn('Speech synthesis not supported in this environment');
        setSpeechInitialized(true);
      }
    }
  };

  const speakText = (text: string) => {
    console.log("speakText called with:", text);
    console.log("audioEnabled:", audioEnabled);
    console.log("speechInitialized:", speechInitialized);

    if (!audioEnabled) {
      console.log("Speech disabled by audioEnabled setting");
      return;
    }

    if (!text || text.trim() === "") {
      console.log("No text to speak");
      return;
    }

    // Initialize speech if not already done
    if (!speechInitialized) {
      console.log("Speech not initialized, initializing now...");
      initializeSpeech();
    }

    // Stop any ongoing speech first (if available)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('speechSynthesis.cancel() failed', e);
      }
    }

    console.log("Creating speech utterance...");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1.0;

    utterance.onstart = () => console.log("Speech started");
    utterance.onend = () => console.log("Speech ended");
    utterance.onerror = (error) => console.error("Speech error:", error);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
      try {
        console.log("Calling speechSynthesis.speak...");
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('speechSynthesis.speak() failed', e);
      }
    } else {
      console.warn('speechSynthesis not available - skipping speak');
    }
  };

  const endInterview = () => {
    // Immediately and completely stop any ongoing speech
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel();
      speechSynthesis.pause();
    }

    // Send end interview message but don't close WebSocket yet - let the backend respond
    if (wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "end_interview",
        })
      );
      // Don't close WebSocket here - let interview_complete handler close it
    }

    // Set ending state to show loading
    setIsEndingInterview(true);

    // Show immediate completion message with inspiring quote
    const inspiringQuotes = [
      "Every expert was once a beginner. Great job on completing this journey!",
      "Success is not final, failure is not fatal: it is the courage to continue that counts. Well done!",
      "The only way to do great work is to love what you do. You've shown dedication today!",
      "Your potential is endless. This interview was just the beginning of your success story!",
      "Growth and comfort do not coexist. You've stepped out of your comfort zone today!",
    ];

    const randomQuote =
      inspiringQuotes[Math.floor(Math.random() * inspiringQuotes.length)];

    // Show completion message immediately
    addChatMessage("system", "Interview completed!");
    addChatMessage("system", randomQuote);

    // Don't navigate here - wait for interview_complete message from backend
  };

  const downloadResults = (sessionId: string) => {
    const API_URL = getApiBase();
    const downloadUrl = `${API_URL}/download_results/${sessionId}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `interview_results_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const connectWebSocket = async (topics: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    addChatMessage("system", "Initializing AI Interview System...");

    try {
      const WS_BASE = getWsBase();
      const ws = new WebSocket(`${WS_BASE}/ws/technical`);

      ws.onopen = () => {
        addChatMessage("system", "Connected to AI Interviewer");
        setIsConnected(true);
        setIsConnecting(false);
        setInterviewStarted(true);
        setQuestionStartTime(Date.now());

        // Initialize speech synthesis on connection (user has already interacted)
        initializeSpeech();

        // Save interview start time for duration calculations
        localStorage.setItem("interviewStartTime", Date.now().toString());

        // Send greeting message from AI interviewer
        const greetingMessage = `Hello! I'm your AI Technical Interviewer. We'll have 4 questions in total, focusing on the topics you selected: ${selectedTopics.join(
          ", "
        )}. Each question will be of increasing difficulty: Easy, Medium, Hard. Let's begin!`;
        addChatMessage("ai", greetingMessage);
        speakText(greetingMessage); // Speak the introduction

        // Initialize technical interview
        ws.send(
          JSON.stringify({
            type: "init_technical",
            topics: selectedTopics,
          })
        );
      };

      ws.onmessage = (event) => {
        const data: WebSocketMessage = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      ws.onclose = () => {
        addChatMessage("system", "Connection terminated");
        setIsConnected(false);
        setInterviewStarted(false);
      };

      ws.onerror = (error) => {
        addChatMessage("system", "System error: " + error);
        setIsConnecting(false);
      };

      wsRef.current = ws;
    } catch (error) {
      addChatMessage("system", "Failed to initialize: " + error);
      setIsConnecting(false);
    }
  };

  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case "stop_speech":
        // Immediately stop any ongoing speech synthesis
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel();
        }
        addChatMessage("system", data.message || "Speech stopped");
        break;

      case "question":
        setCurrentQuestion(data.next_question || "");
        setQuestionStartTime(Date.now());
        setHintsUsed(0);
        setApproachDiscussed(false);
        setCode(getLanguageTemplate(language));
        addChatMessage("ai", data.next_question || "");
        // Don't speak questions - user can read them
        break;

      case "hint":
        const hintMessage = `Here's a hint to help you: ${data.hint}. Now please attempt the question.`;
        addChatMessage("ai", `Hint: ${data.hint}`);
        speakText(hintMessage);

        // Restart hint timer after hint is provided
        if (hintTimer) clearTimeout(hintTimer);
        const hintRestartTimer = setTimeout(() => {
          requestHint();
        }, 60000); // 60 seconds
        setHintTimer(hintRestartTimer);
        break;

      case "code_feedback":
        addChatMessage("ai", `Code feedback: ${data.code_feedback}`);
        break;

      case "approach_feedback":
      case "approach_analyzed":
        // Show user's transcript as their message
        if (data.transcript) {
          addChatMessage("user", data.transcript);
        }

        // Show and speak AI's reply to the approach discussion
        if (data.feedback) {
          addChatMessage("ai", `${data.feedback}`);
          speakText(data.feedback);
        }

        setApproachDiscussed(true);
        setIsRecordingApproach(false);

        // Restart hint timer after approach discussion completes
        if (hintTimer) clearTimeout(hintTimer);
        const newTimer = setTimeout(() => {
          requestHint();
        }, 60000); // 60 seconds
        setHintTimer(newTimer);
        break;

      case "listening":
        addChatMessage("system", "Listening...");
        setIsRecordingApproach(true);
        break;

      case "no_speech":
      case "invalid_transcript":
        addChatMessage("system", `Warning: ${data.message}`);
        setIsRecordingApproach(false);
        break;

      case "recording_stopped":
        addChatMessage("system", "Recording stopped");
        setIsRecordingApproach(false);
        break;

      case "question_complete":
        const timeSpent = Date.now() - questionStartTime;
        const completedQuestionNumber = currentQuestionIndex + 1;
        const newQuestion: Question = {
          id: completedQuestionNumber,
          question: currentQuestion,
          code: code,
          score: data.score || 0,
          timeSpent: timeSpent,
          hintsUsed: hintsUsed,
          completed: true,
        };

        setQuestions((prev) => [...prev, newQuestion]);
        setCurrentQuestionIndex((prev) => prev + 1);
        addChatMessage(
          "ai",
          `Question ${completedQuestionNumber} completed! Score: ${data.score}/100`
        );

        if (data.next_question) {
          console.log("Moving to next question:", data.next_question);
          console.log("Question number:", data.question_number || "unknown");
          console.log(
            "Remaining questions:",
            data.remaining_questions || "unknown"
          );

          const nextQuestionNumber = completedQuestionNumber + 1;
          setTimeout(() => {
            // Clear any existing hint timer
            if (hintTimer) clearTimeout(hintTimer);

            setCurrentQuestion(data.next_question || "");
            setQuestionStartTime(Date.now());
            setHintsUsed(0);
            setApproachDiscussed(false);
            setCode(getLanguageTemplate(language));
            addChatMessage(
              "ai",
              `Question ${nextQuestionNumber}: ${data.next_question || ""}`
            );
            speakText(
              `Here's the next question, question ${nextQuestionNumber}.`
            );
          }, 2000);
        } else {
          console.warn(
            "No next question provided in question_complete message"
          );
          addChatMessage("system", "No next question available");
        }
        break;

      case "interview_complete":
        // Always show completion screen immediately, even if not all questions are done
        if ("speechSynthesis" in window) {
          speechSynthesis.cancel();
          speechSynthesis.pause();
        }
        setIsRecordingApproach(false);
        addChatMessage("ai", "Interview Complete!");
        addChatMessage("ai", data.final_feedback || "");

        // Save session data to localStorage for results page
        const sessionId =
          data.results?.session_id ||
          data.session_id ||
          `session_${Date.now()}`;
        localStorage.setItem(
          "interviewSession",
          JSON.stringify({
            sessionId: sessionId,
            completedAt: new Date().toISOString(),
          })
        );

        // Save complete results data
        const resultsData = {
          session_id: sessionId,
          interview_type: "technical",
          topics: selectedTopics,
          total_questions: data.results?.total_questions || questions.length,
          completed_questions:
            data.results?.completed_questions ||
            questions.filter((q) => q.completed).length,
          average_score:
            data.results?.average_score ||
            questions.reduce((sum, q) => sum + q.score, 0) /
              Math.max(questions.length, 1),
          individual_scores:
            data.results?.individual_scores || questions.map((q) => q.score),
          duration:
            data.results?.duration ||
            data.results?.total_time ||
            Math.floor(
              (Date.now() -
                (localStorage.getItem("interviewStartTime")
                  ? parseInt(localStorage.getItem("interviewStartTime")!)
                  : Date.now())) /
                1000
            ),
          start_time:
            data.results?.start_time ||
            localStorage.getItem("interviewStartTime") ||
            new Date(Date.now() - 600000).toISOString(),
          end_time: data.results?.end_time || new Date().toISOString(),
          status: "completed",
          completion_method:
            data.results?.completion_method || "manually_ended",
          final_results: data.results || { manually_completed: true },
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("interviewResults", JSON.stringify(resultsData));

        // Wait exactly 2.5 seconds before showing completion screen
        setTimeout(() => {
          setIsEndingInterview(false); // Hide loading screen
          setInterviewCompleted(true); // Show completion screen
          setInterviewStarted(false); // Now safe to set false after completion screen is shown
          
          // Close WebSocket after showing completion
          setTimeout(() => {
            if (wsRef.current) {
              wsRef.current.close();
              wsRef.current = null;
            }
            setIsConnected(false);
          }, 2000);
        }, 2500); // EXACTLY 2.5 seconds
        break;

      case "error":
        addChatMessage("system", `Error: ${data.error}`);
        setIsRecordingApproach(false);
        break;
    }
  };

  // Interview completion screen
  if (interviewCompleted) {
    const handleReturn = () => {
      setIsExiting(true);  // Start exit animation
      
      // Wait for animation to complete (500ms) THEN navigate
      setTimeout(() => {
        // RESET ALL STATES before navigating
        setIsEndingInterview(false);
        setInterviewCompleted(false);
        setInterviewStarted(false);
        setSelectedTopics([]);
        setCurrentQuestion("");
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setChatMessages([]);
        setInterviewResults(null);
        setShowResults(false);
        
        // Clear any stored session data
        localStorage.removeItem("interviewSession");
        localStorage.removeItem("interviewResults");
        localStorage.removeItem("interviewStartTime");
        
        router.push("/interview");  // Navigate after animation
      }, 500);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-violet-50 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen pt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ 
              opacity: isExiting ? 0 : 1, 
              scale: isExiting ? 0.9 : 1,
              y: isExiting ? 50 : 0
            }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto p-12 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              className="flex items-center justify-center mb-6"
            >
              <CheckCircle className="w-20 h-20 text-cyan-500 mr-4" />
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">
                  Interview Complete!
                </h1>
                <div className="w-32 h-1 bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full mx-auto mt-3"></div>
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-600 text-xl mb-8 leading-relaxed"
            >
              Excellent work! Your interview has been completed and your result
              will be updated soon....
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col space-y-4 max-w-md mx-auto"
            >
              <motion.button
                whileHover={{ scale: isExiting ? 1 : 1.05, y: isExiting ? 0 : -2 }}
                whileTap={{ scale: isExiting ? 1 : 0.95 }}
                onClick={handleReturn}
                disabled={isExiting}
                className="w-full px-8 py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white font-bold rounded-2xl hover:from-cyan-600 hover:via-blue-700 hover:to-purple-700 transition-all duration-300 shadow-xl hover:shadow-2xl flex items-center justify-center group relative overflow-hidden disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform relative z-10" />
                <span className="relative z-10">
                  Practice Another Interview
                </span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
              </motion.button>
            </motion.div>

            {/* Decorative elements */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-r from-cyan-400/20 to-violet-400/20 rounded-full blur-xl"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-r from-violet-400/20 to-cyan-400/20 rounded-full blur-xl"
            />
          </motion.div>
        </div>
      </div>
    );
  }

  if (!interviewStarted) {
    return (
      <div className="min-h-screen bg-gray-50 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 z-50"
        >
          <Link 
            href="/interview" 
            className="inline-flex items-center space-x-2 text-cyan-600 hover:text-cyan-700 transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2 rounded-full shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium hidden sm:inline">Back to Selection</span>
            <span className="font-medium sm:hidden">Back</span>
          </Link>
        </motion.div>

        <div className="flex items-center justify-center min-h-screen pt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto p-8 bg-white rounded-3xl border border-gray-200 shadow-xl"
          >
            <div className="text-center mb-8">
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="flex items-center justify-center mb-4"
              >
                <Brain className="w-12 h-12 text-cyan-400 mr-3" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                  AI Technical Interview
                </h1>
              </motion.div>
              <p className="text-gray-600 text-lg">
                Select your focus areas to begin the assessment
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Cpu className="w-5 h-5 mr-2 text-cyan-600" />
                  Topics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_TOPICS.map((topic, index) => (
                    <motion.label
                      key={topic}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center space-x-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 shadow-sm hover:shadow-md ${
                        selectedTopics.includes(topic)
                          ? "bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-400 text-cyan-800 shadow-cyan-200"
                          : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          selectedTopics.includes(topic)
                            ? "bg-cyan-500 border-cyan-500"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedTopics.includes(topic) && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedTopics.includes(topic)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTopics([...selectedTopics, topic]);
                          } else {
                            setSelectedTopics(
                              selectedTopics.filter((t) => t !== topic)
                            );
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="font-medium">{topic}</span>
                    </motion.label>
                  ))}
                </div>
              </div>

              <motion.button
                whileHover={{
                  scale: 1.02,
                  y: -3,
                  boxShadow: "0 25px 50px -10px rgba(6, 182, 212, 0.8)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() => connectWebSocket(selectedTopics)}
                disabled={selectedTopics.length === 0 || isConnecting}
                className="w-full py-5 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white rounded-2xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center justify-center space-x-3 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {isConnecting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin relative z-10" />
                    <span className="relative z-10">
                      Initializing AI System...
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6 relative z-10" />
                    <span className="relative z-10">Start Interview</span>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"></div>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Show loading screen when ending interview
  if (isEndingInterview) {
    return (
      <div className="min-h-screen bg-gray-50 overflow-hidden">
        <div className="flex items-center justify-center min-h-screen pt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto p-8 bg-white rounded-3xl border border-gray-200 shadow-xl text-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-8 h-8 text-white" />
            </motion.div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ending Interview...
            </h2>
            <p className="text-gray-600 text-lg">
              Please wait while we process your results
            </p>

            <div className="mt-6 flex justify-center">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden">
      {/* Main Interview Interface */}
      <div className="h-screen flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-white border-b border-gray-200 shadow-sm gap-2 sm:gap-3"
        >
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:flex-1 min-w-0">
            <Brain className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-cyan-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-gray-900 truncate">
                AI Technical Interview
              </h1>
              <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-3 lg:gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
                <span className="whitespace-nowrap">Q{currentQuestionIndex + 1}</span>
                <span className="hidden sm:inline text-gray-400">•</span>
                <span className="whitespace-nowrap">Hints: {hintsUsed}</span>
                <span className="hidden sm:inline text-gray-400">•</span>
                <span className="whitespace-nowrap">
                  {Math.floor((Date.now() - questionStartTime) / 1000)}s
                </span>
                {approachDiscussed && (
                  <>
                    <span className="hidden sm:inline text-gray-400">•</span>
                    <span className="text-green-600 whitespace-nowrap flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      <span className="hidden sm:inline">Approach</span>
                      <span className="sm:hidden">✓</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center space-x-1.5 sm:space-x-2 bg-green-50 border border-green-200 px-2.5 sm:px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
              <span className="text-xs sm:text-sm text-green-700 font-medium whitespace-nowrap">Live</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/")}
              className="p-2 sm:p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden pb-20 lg:pb-0">
          {/* Left Side - Code Editor */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:flex-[3_2_0%] lg:min-w-[500px] xl:min-w-[600px] 2xl:min-w-[700px] min-w-0 flex flex-col bg-white lg:border-r border-gray-200 min-h-[400px] lg:min-h-0"
          >
            {/* Language Selector */}
            <div className="flex flex-col gap-3 p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-2 sm:space-x-3 w-full">
                <Terminal className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 flex-shrink-0" />
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    setCode(getLanguageTemplate(e.target.value));
                  }}
                  className="bg-white border-2 border-gray-300 rounded-lg px-3 sm:px-4 py-2.5 text-sm sm:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 w-full sm:w-auto min-h-[46px] font-medium"
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={requestHint}
                  className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 min-h-[46px]"
                >
                  <Zap className="w-4 h-4 flex-shrink-0" />
                  <span>Hint</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={
                    isRecordingApproach
                      ? stopApproachDiscussion
                      : discussApproach
                  }
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 min-h-[46px] ${
                    isRecordingApproach
                      ? "bg-gradient-to-r from-red-500 to-pink-600 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                  }`}
                >
                  <Mic
                    className={`w-4 h-4 flex-shrink-0 ${
                      isRecordingApproach ? "animate-pulse" : ""
                    }`}
                  />
                  <span>{isRecordingApproach ? "Stop" : "Discuss"}</span>
                </motion.button>
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 p-3 sm:p-4 lg:p-5 overflow-hidden">
              <div className="relative w-full h-full">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full h-full min-h-[300px] sm:min-h-[350px] lg:min-h-[450px] max-h-[500px] sm:max-h-[600px] lg:max-h-[700px] bg-white border-2 border-gray-300 text-gray-900 font-mono text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-vertical rounded-lg p-3 sm:p-4 touch-manipulation
                  overflow-y-auto
                  [&::-webkit-scrollbar]:w-2
                  [&::-webkit-scrollbar-track]:bg-gray-100
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-gray-400
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb:hover]:bg-gray-500
                  [&::-webkit-scrollbar-thumb]:transition-colors"
                  placeholder="Write your solution here..."
                  spellCheck={false}
                  style={{ 
                    lineHeight: '1.6',
                    overflowY: 'auto',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch'
                  }}
                />
                {/* Line count indicator */}
                {code && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 bg-gray-800/80 text-white text-xs rounded-md pointer-events-none font-mono">
                    {code.split('\n').length} lines
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button - Desktop Only */}
            <div className="hidden lg:flex p-3 sm:p-4 lg:p-5 bg-gray-50 border-t border-gray-200 flex-col gap-3 flex-shrink-0">
              <motion.button
                whileHover={{
                  scale: 1.02,
                  y: -2,
                  boxShadow: "0 20px 40px -10px rgba(6, 182, 212, 0.6)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={submitCode}
                disabled={!code.trim()}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white rounded-xl text-base sm:text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 relative overflow-hidden group min-h-[50px]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <Send className="w-5 h-5 relative z-10 flex-shrink-0" />
                <span className="relative z-10">Submit Solution</span>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
              </motion.button>

              <motion.button
                whileHover={{
                  scale: 1.02,
                  y: -1,
                  boxShadow: "0 15px 35px -5px rgba(239, 68, 68, 0.5)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={endInterview}
                disabled={isEndingInterview}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-base sm:text-lg font-bold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-50 disabled:cursor-not-allowed min-h-[50px]"
              >
                <span>End Interview</span>
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform flex-shrink-0" />
              </motion.button>
            </div>
          </motion.div>

          {/* Right Side - Question & Chat */}
          <div className="flex flex-col lg:flex-row w-full lg:flex-[2_1_0%] lg:min-w-[380px] lg:max-w-[500px] xl:min-w-[420px] xl:max-w-[550px] 2xl:max-w-[600px] min-w-0 h-auto lg:h-full border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto lg:overflow-y-visible">
            <div className="w-full lg:flex-1 lg:min-w-0 flex flex-col h-auto lg:h-full">
              {/* Question Panel */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 sm:p-4 bg-white border-b border-gray-200 min-h-[250px] lg:h-1/2 overflow-y-auto flex-shrink-0"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600 flex-shrink-0" />
                    <span>Question</span>
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.1, y: -1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      initializeSpeech();
                      speakText(currentQuestion);
                    }}
                    className="p-2.5 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border-2 border-purple-200 min-h-[160px] lg:h-[calc(100%-60px)] overflow-y-auto">
                  <p className="text-gray-800 text-sm sm:text-base lg:text-lg leading-relaxed break-words">
                    {currentQuestion || "Loading question..."}
                  </p>
                  {currentQuestion && (
                    <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-xs sm:text-sm text-emerald-700 flex items-start">
                        <Mic className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="break-words">Tap "Discuss" to explain your approach with the AI interviewer</span>
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Camera Preview */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 sm:p-4 bg-white border-b lg:border-b-0 border-gray-200 min-h-[250px] lg:h-1/2 overflow-y-auto flex-shrink-0"
              >
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <h4 className="text-base font-bold text-gray-900 flex items-center">
                      <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-cyan-600 flex-shrink-0" />
                      Camera
                    </h4>

                    <div className="flex flex-row gap-2 sm:gap-3">
                    <motion.button
                      whileHover={{ scale: 1.1, y: -1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() =>
                        chatOpened ? setChatOpened(false) : setChatOpened(true)
                      }
                      className={`p-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 ${
                        chatOpened
                          ? "bg-green-50 border border-green-200 text-green-700"
                          : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <MessageSquareText className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1, y: -1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={cameraEnabled ? stopCamera : initializeCamera}
                      className={`p-2.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 ${
                        cameraEnabled
                          ? "bg-green-50 border border-green-200 text-green-700"
                          : "bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {cameraEnabled ? (
                        <Camera className="w-4 h-4" />
                      ) : (
                        <CameraOff className="w-4 h-4" />
                      )}
                    </motion.button>
                  </div>
                </div>

                <div className="flex-1 min-h-[200px]">
                  <div
                    className="relative bg-gray-100 rounded-xl overflow-hidden border-2 border-gray-300 aspect-video w-full"
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!cameraEnabled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                        <CameraOff className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </motion.div>
            </div>

            {/* Mobile Sticky Button Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 p-3 shadow-2xl z-50">
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={submitCode}
                  disabled={!code.trim()}
                  className="flex-1 py-3.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 text-white rounded-xl text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 min-h-[50px] touch-manipulation"
                >
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span>Submit</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={endInterview}
                  disabled={isEndingInterview}
                  className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-base font-bold shadow-lg flex items-center justify-center gap-2 min-h-[50px] touch-manipulation"
                >
                  <span>End</span>
                  <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                </motion.button>
              </div>
            </div>

            {/* AI Chat */}
            <AnimatePresence>
              {chatOpened && (
                <motion.div
                  initial={{ opacity: 0, x: "100%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: "100%" }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="w-full lg:w-[380px] xl:w-[420px] 2xl:w-[450px] lg:flex-shrink-0 flex flex-col bg-white border-t lg:border-t-0 lg:border-l border-gray-200 max-h-[400px] lg:max-h-none lg:h-full"
                >
                  <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-cyan-600" />
                      <span className="hidden sm:inline">AI Assistant</span>
                      <span className="sm:hidden">AI Chat</span>
                    </h3>
                    <motion.button
                      whileHover={{ scale: 1.1, y: -1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setAudioEnabled(!audioEnabled)}
                      className={`p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] min-w-[44px] flex items-center justify-center ${
                        audioEnabled
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                      }`}
                    >
                      {audioEnabled ? (
                        <Volume2 className="w-4 h-4" />
                      ) : (
                        <VolumeX className="w-4 h-4" />
                      )}
                    </motion.button>
                  </div>

                  <div
                    ref={chatContainerRef}
                    className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3"
                  >
                    <AnimatePresence>
                      {chatMessages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className={`flex items-start space-x-3 ${
                            message.type === "user" ? "justify-end" : ""
                          }`}
                        >
                          {message.type !== "user" && (
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                message.type === "ai"
                                  ? "bg-cyan-100"
                                  : "bg-gray-100"
                              }`}
                            >
                              {message.type === "ai" ? (
                                <Bot className="w-4 h-4 text-cyan-600" />
                              ) : (
                                <Zap className="w-4 h-4 text-gray-600" />
                              )}
                            </div>
                          )}

                          <div
                            className={`max-w-[75%] sm:max-w-xs px-3 py-2 rounded-lg text-xs sm:text-sm ${
                              message.type === "user"
                                ? "bg-cyan-500 text-white ml-4 sm:ml-8"
                                : message.type === "ai"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            <p className="leading-relaxed break-words">{message.content}</p>
                            <span className="text-xs opacity-60 mt-1 block">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>

                          {message.type === "user" && (
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <User className="w-4 h-4 text-blue-400" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {showResults && interviewResults && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Interview Results
              </h2>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowResults(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            <div className="space-y-4 text-gray-800">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-cyan-600 font-semibold mb-2">
                    Final Score
                  </h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {interviewResults.average_score}/100
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-cyan-600 font-semibold mb-2">
                    Questions Completed
                  </h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {interviewResults.completed_questions}/
                    {interviewResults.total_questions}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-cyan-600 font-semibold mb-2">Total Time</h3>
                <p className="text-gray-900">
                  {Math.round(interviewResults.total_time / 60)} minutes
                </p>
              </div>

              {interviewResults.final_evaluation && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="text-cyan-600 font-semibold mb-2">
                    Detailed Feedback
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Correctness:</strong>{" "}
                      {interviewResults.final_evaluation.correctness}
                    </p>
                    <p>
                      <strong>Approach Quality:</strong>{" "}
                      {interviewResults.final_evaluation.approach_quality}
                    </p>
                    <p>
                      <strong>Code Quality:</strong>{" "}
                      {interviewResults.final_evaluation.code_quality}
                    </p>
                    {interviewResults.final_evaluation
                      .areas_for_improvement && (
                      <div>
                        <strong>Areas for Improvement:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {interviewResults.final_evaluation.areas_for_improvement.map(
                            (area: string, index: number) => (
                              <li key={index}>{area}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => downloadResults(interviewResults.session_id)}
                  className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-semibold shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Download Results</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowResults(false)}
                  className="flex-1 py-3 bg-gray-500 text-white rounded-lg font-semibold shadow-lg hover:bg-gray-600 transition-colors"
                >
                  Close
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
