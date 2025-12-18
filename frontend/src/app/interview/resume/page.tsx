'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../../../components/Navbar';
import { FileText, Upload, Mic, CheckCircle, Loader2, Play, ArrowLeft, Camera, CameraOff, Code2, Send, X, MessageSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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
  download_url?: string;
}

export default function ResumeInterviewPage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [phase, setPhase] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeInfo, setResumeInfo] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [answer, setAnswer] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [blockVAD, setBlockVAD] = useState(false); // Strict VAD blocking during typing
  const [lastSpeechEndTime, setLastSpeechEndTime] = useState(0); // Track when AI last spoke
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [chatPanelWidth, setChatPanelWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [cameraSize, setCameraSize] = useState({ width: 320, height: 240 });
  const [isResizingCamera, setIsResizingCamera] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  
  // Code editor states
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [code, setCode] = useState('');
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  // Responsive states
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(true);
  
  // Typing detection state to prevent voice recording during typing
  const [isTyping, setIsTyping] = useState(false);
  
  // WebSocket reconnection state
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const endTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const HTTP_BASE = process.env.NEXT_PUBLIC_API_URL!;
  const WS_URL = `${process.env.NEXT_PUBLIC_WS_URL}/ws`;

  // Debug: Log env vars on mount
  useEffect(() => {
    console.log('🔧 ENV DEBUG:', {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
      computedWS_URL: WS_URL
    });
  }, []);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const setPhaseStatus = (text: string) => {
    setPhase(text);
  };

  // TEXT SIMILARITY HELPER: Calculate how similar two texts are (0-1 scale)
  const calculateTextSimilarity = (text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    // Calculate Jaccard similarity coefficient
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  const startCamera = async () => {
    try {
      console.log('📷 Requesting camera and microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ Camera and microphone access granted');
      console.log('🎤 Audio tracks:', stream.getAudioTracks().map(t => t.label));
      console.log('📹 Video tracks:', stream.getVideoTracks().map(t => t.label));
      
      setCameraStream(stream);
      setIsCameraOn(true);
      
      // Ensure video element gets the stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Force video to play
        videoRef.current.play().catch(console.error);
      }
      
      addLog('Camera started successfully');
      console.log('✅ Camera and microphone initialized');
    } catch (error) {
      console.error('❌ Error accessing camera/microphone:', error);
      alert('Please allow camera AND microphone access for the interview to work properly');
      addLog('Camera access denied or not available');
      setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOn(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 280 && newWidth <= 600) {
      setChatPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Camera drag handlers
  const handleCameraDragStart = (e: React.MouseEvent) => {
    if (!cameraRef.current) return;
    const rect = cameraRef.current.getBoundingClientRect();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleCameraDragMove = (e: MouseEvent) => {
    if (!isDragging || !cameraRef.current) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Constrain to viewport bounds
    const maxX = window.innerWidth - cameraSize.width;
    const maxY = window.innerHeight - cameraSize.height;
    
    setCameraPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  const handleCameraDragEnd = () => {
    setIsDragging(false);
  };

  // Camera resize handlers
  const handleCameraResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dragging when resizing
    setIsResizingCamera(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: cameraSize.width, height: cameraSize.height });
  };

  const handleCameraResizeMove = (e: MouseEvent) => {
    if (!isResizingCamera) return;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    const newWidth = Math.max(200, Math.min(800, resizeStartSize.width + deltaX));
    const newHeight = Math.max(150, Math.min(600, resizeStartSize.height + deltaY));
    
    setCameraSize({ width: newWidth, height: newHeight });
  };

  const handleCameraResizeEnd = () => {
    setIsResizingCamera(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleCameraDragMove);
      document.addEventListener('mouseup', handleCameraDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleCameraDragMove);
        document.removeEventListener('mouseup', handleCameraDragEnd);
      };
    }
  }, [isDragging, dragOffset, cameraSize]);

  useEffect(() => {
    if (isResizingCamera) {
      document.addEventListener('mousemove', handleCameraResizeMove);
      document.addEventListener('mouseup', handleCameraResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleCameraResizeMove);
        document.removeEventListener('mouseup', handleCameraResizeEnd);
      };
    }
  }, [isResizingCamera, resizeStartPos, resizeStartSize]);
  
  // Responsive layout handler
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      setIsTablet(width >= 768 && width < 1024);
      
      // Adjust chat panel width based on screen size
      if (width < 768) {
        setChatPanelWidth(width);
        setShowChatPanel(true); // Always show chat on mobile
      } else if (width < 1024) {
        setChatPanelWidth(Math.min(400, width * 0.4));
        setShowChatPanel(true);
      } else {
        setChatPanelWidth(Math.min(600, width * 0.35));
        setShowChatPanel(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startServerVAD = () => {
    // ONLY block if user is actively typing (removed textarea content check)
    if (isTyping || blockVAD) {
      console.log('⛔ VAD BLOCKED - User is actively typing');
      return;
    }

    // ECHO PREVENTION
    const timeSinceLastSpeech = Date.now() - lastSpeechEndTime;
    if (lastSpeechEndTime > 0 && timeSinceLastSpeech < 2000) {
      console.log(`⏸️ Waiting for speech cooldown... (${Math.round((2000 - timeSinceLastSpeech) / 1000)}s remaining)`);
      setTimeout(startServerVAD, 2000 - timeSinceLastSpeech);
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    console.log('🎤 Starting client recording - speak now');
    setPhaseStatus('Listening...');
    recordAndSendAnswer();
  };

  // Record mic locally and send transcript to backend
  const recordAndSendAnswer = async () => {
    try {
      // Ensure we have an audio stream
      let stream = cameraStream;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
      }

      const chunks: BlobPart[] = [];
      // Pick a supported audio mime type across browsers
      const pickSupportedMime = (): string => {
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/ogg;codecs=opus',
          'audio/mp4',
          'audio/webm'
        ];
        for (const type of candidates) {
          // @ts-ignore
          if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(type)) {
            return type;
          }
        }
        return 'audio/webm';
      };

      const mimeType = pickSupportedMime();
      console.log('🎙️ Using recorder mime type:', mimeType);
      const recorder = new MediaRecorder(stream, { mimeType });

      const stopPromise = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onerror = (e) => reject(e);
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start();
      // Record up to 6 seconds; user should speak immediately
      setTimeout(() => {
        try { recorder.stop(); } catch {}
      }, 6000);

      const blob = await stopPromise;

      const form = new FormData();
      const filename = mimeType.includes('mp4') ? 'answer.m4a' : (mimeType.includes('ogg') ? 'answer.ogg' : 'answer.webm');
      form.append('file', blob, filename);
      const res = await fetch(`${HTTP_BASE}/transcribe_audio`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        console.error('❌ Transcribe failed:', res.statusText);
        setPhaseStatus('');
        return;
      }
      const data = await res.json();
      const transcript = (data?.transcript || '').trim();
      if (!transcript) {
        console.log('🤫 No transcript returned');
        setPhaseStatus('');
        return;
      }

      // Send to backend as a normal answer to continue interview
      wsRef.current?.send(JSON.stringify({ type: 'answer', text: transcript }));
      addLog('You: ' + transcript);
      setPhaseStatus('');
    } catch (e) {
      console.error('❌ Error recording/transcribing:', e);
      setPhaseStatus('');
    }
  };

  const speakAndThenRecord = (text: string) => {
    if (!text || !text.trim()) {
      console.log('⚠️ speakAndThenRecord: Empty text');
      return;
    }
    
    console.log('🔊 speakAndThenRecord called with text:', text.substring(0, 50) + '...');
    
    // Don't interrupt ongoing speech unless this is a new important question
    if (window.speechSynthesis.speaking) {
      console.log('⏸️ Speech already in progress');
      
      // Only cancel for new questions (indicated by length or question mark)
      const isNewQuestion = text.includes('?') || text.length > 100;
      
      if (!isNewQuestion) {
        console.log('⏩ Not interrupting current speech for continuation');
        return; // Don't interrupt for short continuations
      }
      
      console.log('🔄 Cancelling current speech for new question');
      window.speechSynthesis.cancel();
    }
    
    setPhaseStatus('Speaking...');
    try {
      if (!('speechSynthesis' in window)) {
        console.log('⚠️ speechSynthesis not available in window');
        setTimeout(startServerVAD, 400);
        return;
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      // Normal speech rate for natural delivery
      utterance.rate = 1.0; // Normal speed
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      setIsSpeaking(true);
      
      const startTime = Date.now();
      
      utterance.onstart = () => {
        const elapsed = Date.now() - startTime;
        console.log(`🗣️ Speech started in ${elapsed}ms`);
      };
      
      utterance.onend = () => {
        console.log('✅ Speech synthesis ended');
        setIsSpeaking(false);
        
        // Record when speech ended for cooldown tracking
        setLastSpeechEndTime(Date.now());
        
        // OPTIMIZED: Reduced delay from 2000ms to 800ms for faster VAD start
        setTimeout(() => {
          console.log('🎯 Starting VAD after 800ms delay (optimized)');
          startServerVAD();
        }, 800); // Reduced from 2000ms
      };
      
      utterance.onerror = (e) => {
        console.error('❌ Speech synthesis error:', e);
        setIsSpeaking(false);
        
        // Still start VAD even on error, but with delay
        setTimeout(() => {
          startServerVAD();
        }, 500);
      };
      
      window.speechSynthesis.speak(utterance);
      console.log('📢 Speech synthesis speak() called');
      
    } catch (e) {
      console.error('❌ Error in speakAndThenRecord:', e);
      setIsSpeaking(false);
      setTimeout(startServerVAD, 500);
    }
  };

  const connectWebSocket = async () => {
    setIsConnecting(true);
    
    // Clear any existing connection
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {
        console.error('Error closing existing WebSocket:', e);
      }
      wsRef.current = null;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      console.log('🚀 Connecting to WebSocket at:', WS_URL);
      wsRef.current = new WebSocket(WS_URL);
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setReconnectAttempts(0);
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        // Stop speech synthesis
        try {
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        } catch {}
        setPhaseStatus('');
        
        // Attempt reconnection if interview is active and not intentionally closed
        if (interviewStarted && !isEndingInterview && reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (e) => {
        console.error('❌ WebSocket error:', e);
        setIsConnecting(false);
      };

    wsRef.current.onmessage = (ev) => {
      try {
        const msg: WebSocketMessage = JSON.parse(ev.data);
        console.log('📩 WebSocket message received:', msg);
        
        if (msg.type === 'ready') {
          // Clear thinking status and show speaking status
          setPhaseStatus('AI is speaking...');
          
          // Don't show "READY:" in chat - only process question
          if (msg.next_question) {
            addLog('Q: ' + msg.next_question);
            
            // CRITICAL: Force clear textarea to prevent any residual text
            setAnswer('');
            setIsTyping(false);
            setBlockVAD(false);
            
            // Double-check textarea is clear after React update
            setTimeout(() => {
              if (answer.trim().length > 0) {
                console.warn('⚠️ Textarea still has content after clear, forcing reset');
                setAnswer('');
              }
            }, 100);
            
            // Check if this is a coding question - VERY SPECIFIC patterns only
            const isCodingQuestion = (
              /write\s+(a\s+)?(code|function|program|script|class)/i.test(msg.next_question) ||
              /implement\s+(a\s+)?(function|class|algorithm|method)/i.test(msg.next_question) ||
              /create\s+(a\s+)?(function|program|script)/i.test(msg.next_question) ||
              msg.next_question.toLowerCase().includes('write code to') ||
              msg.next_question.toLowerCase().includes('code a solution')
            );
            
            setIsCodeMode(isCodingQuestion);
            setShowCodeEditor(isCodingQuestion);
            
            if (isCodingQuestion) {
              // Reset answer when switching to code mode
              setAnswer('');
              setPhaseStatus('Please write your code and click Submit when ready');
              console.log('💻 Code mode activated for question');
              // For coding questions, don't auto-start recording
            } else {
              // Reset code when switching to text mode
              setCode('');
              setShowCodeEditor(false);
              setIsCodeMode(false);
              speakAndThenRecord(msg.next_question);
            }
          }
        } else if (msg.type === 'assessment') {
          // Don't show evaluation, hint, or final_feedback in UI - only store in backend JSON
          if (msg.next_question) {
            addLog('Q: ' + msg.next_question);
            
            // CRITICAL: Force clear textarea to prevent any residual text
            setAnswer('');
            setIsTyping(false);
            setBlockVAD(false);
            
            // Double-check textarea is clear after React update
            setTimeout(() => {
              if (answer.trim().length > 0) {
                console.warn('⚠️ Textarea still has content after clear, forcing reset');
                setAnswer('');
              }
            }, 100);
            
            // Check if this is a coding question - VERY SPECIFIC patterns only
            const isCodingQuestion = (
              /write\s+(a\s+)?(code|function|program|script|class)/i.test(msg.next_question) ||
              /implement\s+(a\s+)?(function|class|algorithm|method)/i.test(msg.next_question) ||
              /create\s+(a\s+)?(function|program|script)/i.test(msg.next_question) ||
              msg.next_question.toLowerCase().includes('write code to') ||
              msg.next_question.toLowerCase().includes('code a solution')
            );
            
            setIsCodeMode(isCodingQuestion);
            setShowCodeEditor(isCodingQuestion);
            
            if (isCodingQuestion) {
              // Reset answer when switching to code mode
              setAnswer('');
              setPhaseStatus('Please write your code and click Submit when ready');
              console.log('💻 Code mode activated for question');
              // For coding questions, don't auto-start recording
            } else {
              // Reset code when switching to text mode
              setCode('');
              setShowCodeEditor(false);
              setIsCodeMode(false);
              speakAndThenRecord(msg.next_question);
            }
          } else {
            // When no next question, ensure code editor is hidden
            setPhaseStatus('');
            setShowCodeEditor(false);
            setIsCodeMode(false);
            setCode('');
          }
        } else if (msg.type === 'listening') {
          // Don't show "LISTENING:" in chat - only set phase
          console.log('👂 Backend is listening for speech...');
          console.log('⚠️ SPEAK NOW - Microphone is active');
          setPhaseStatus('Listening...');
        } else if (msg.type === 'transcribed') {
          console.log('📨 TRANSCRIPT MESSAGE RECEIVED FROM BACKEND');
          
          // IMMEDIATE FEEDBACK: Show AI is processing
          setPhaseStatus('AI is thinking...');
          
          // Show user's transcript in chat
          if (msg.transcript) {
            let transcript = msg.transcript.trim();
            console.log('🎤 Raw transcript received:', transcript);
            console.log('📏 Transcript length:', transcript.length, 'words:', transcript.split(/\s+/).length);
            
            // ABSOLUTE BLOCKING: Get last AI question for comprehensive comparison
            const lastLogs = logs.slice(-5); // Check last 5 messages
            const lastAIQuestion = lastLogs.reverse().find(log => log.startsWith('Q:'))?.replace('Q: ', '').trim() || '';
            
            if (lastAIQuestion) {
              console.log('🔍 Last AI Question:', lastAIQuestion.substring(0, 100) + '...');
            }
            
            // ULTRA-CRITICAL FILTER 1: Detect AI question patterns (questions, long sentences)
            const aiQuestionPatterns = [
              /^(can you|could you|would you|will you|tell me|walk me through|elaborate|explain|describe)/i,
              /^(how did you|what did you|why did you|when did you|where did you)/i,
              /^(let's|also,|for (example|instance)|you('ve| have) (also )?mentioned)/i,
              /^(you mentioned|you're (currently )?pursuing|you're taking)/i,
              /\?$/,  // Ends with question mark
            ];
            
            // Check if transcript matches typical AI question patterns
            const looksLikeAIQuestion = aiQuestionPatterns.some(pattern => pattern.test(transcript));
            
            if (looksLikeAIQuestion) {
              console.log('🚫 BLOCKED: Transcript matches AI question pattern');
              console.log('   Pattern detected in:', transcript.substring(0, 80) + '...');
              setPhaseStatus('');
              return;
            }
            
            // NO LENGTH LIMIT: Allow any length of user speech
            console.log('✅ Transcript accepted, length:', transcript.length, 'chars');
            
            // CRITICAL FILTER 3: Calculate exact similarity with AI question
            if (lastAIQuestion && lastAIQuestion.length > 15) {
              const similarity = calculateTextSimilarity(transcript, lastAIQuestion);
              console.log(`📊 Transcript similarity to AI question: ${(similarity * 100).toFixed(1)}%`);
              
              // ULTRA-STRICT BLOCKING: If >10% similar, it's AI speech echo
              if (similarity > 0.10) {
                console.log('🚫 BLOCKED: Transcript too similar to AI question');
                console.log('   AI Question:', lastAIQuestion.substring(0, 80) + '...');
                console.log('   Transcript:', transcript.substring(0, 80) + '...');
                setPhaseStatus('');
                return;
              }
              
              // Check if transcript contains significant portion of AI question
              const transcriptLower = transcript.toLowerCase();
              const aiLower = lastAIQuestion.toLowerCase();
              
              // If AI question is contained in transcript or vice versa
              if (transcriptLower.includes(aiLower.substring(0, Math.min(40, aiLower.length))) ||
                  aiLower.includes(transcriptLower.substring(0, Math.min(40, transcriptLower.length)))) {
                console.log('🚫 BLOCKED: Transcript contains AI question text');
                setPhaseStatus('');
                return;
              }
            }
            
            // FILTER 4: Strip any AI question prefix if embedded
            if (lastAIQuestion && lastAIQuestion.length > 15 && transcript.length > 50) {
              const aiQuestionLower = lastAIQuestion.toLowerCase();
              const transcriptLower = transcript.toLowerCase();
              
              // Find where AI question ends in transcript
              const aiWords = aiQuestionLower.split(/\s+/);
              for (let i = Math.min(aiWords.length, 20); i >= 5; i--) {
                const aiPrefix = aiWords.slice(0, i).join(' ');
                const aiPrefixIndex = transcriptLower.indexOf(aiPrefix);
                
                if (aiPrefixIndex !== -1) {
                  // Found AI question in transcript - strip everything before user's actual answer
                  const strippedTranscript = transcript.substring(aiPrefixIndex + aiPrefix.length).trim();
                  console.log('✂️ STRIPPED AI question from transcript');
                  console.log('   Original length:', transcript.length);
                  console.log('   Stripped length:', strippedTranscript.length);
                  transcript = strippedTranscript;
                  break;
                }
              }
            }
            
            // FILTER 5: Reject very short or empty transcripts
            const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
            if (wordCount <= 2 || transcript.length < 3) {
              console.log('🔇 Filtered: Too short or empty after processing:', transcript);
              setPhaseStatus('');
              return;
            }
            
            // FILTER 6: Enhanced keyboard noise and gibberish patterns
            const keyboardPatterns = [
              'mask', 'click', 'clack', 'tap', 'type', 'keyboard',
              'the', 'and', 'of', 'to', 'a', 'in', 'is', 'that',
              'can', 'you', 'this', 'is', 'oh', 'see', 'get'
            ];
            
            // Check for gibberish (random characters/foreign words)
            const gibberishPatterns = /entsprechende|[äöüß]|\b\w{15,}\b/i;
            if (gibberishPatterns.test(transcript)) {
              console.log('🔇 Filtered gibberish/foreign text:', transcript);
              setPhaseStatus('');
              return;
            }
            
            const words = transcript.toLowerCase().split(/\s+/);
            const isKeyboardNoise = words.length <= 3 && words.every(word => 
              keyboardPatterns.includes(word.toLowerCase())
            );
            
            if (isKeyboardNoise) {
              console.log('🔇 Filtered keyboard noise:', transcript);
              setPhaseStatus('');
              return;
            }
            
            // FILTER 7: Word overlap ratio
            if (lastAIQuestion && lastAIQuestion.length > 20) {
              const aiWords = lastAIQuestion.toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 3);
              
              const transcriptWords = transcript.toLowerCase()
                .split(/\s+/)
                .filter(w => w.length > 3);
              
              const matchingWords = transcriptWords.filter(word => aiWords.includes(word));
              const matchRatio = transcriptWords.length > 0 ? matchingWords.length / transcriptWords.length : 0;
              
              if (matchRatio > 0.5) {
                console.log(`🔇 Filtered: ${(matchRatio * 100).toFixed(0)}% word overlap with AI question`);
                setPhaseStatus('');
                return;
              }
            }
            
            // Only add valid transcripts that pass ALL filters
            console.log('✅ VALID USER RESPONSE:', transcript);
            addLog('You: ' + transcript);
          }
          setPhaseStatus('');
        } else if (msg.type === 'no_speech') {
          // Don't show "NO SPEECH:" in chat - only reset phase
          console.log('🤫 No speech detected by backend');
          console.log('⚠️ Backend heard silence or could not transcribe audio');
          console.log('💡 TIP: Speak louder and clearer after you see "Listening..."');
          setPhaseStatus('');
        } else if (msg.type === 'invalid_transcript') {
          // Don't show "INVALID:" in chat - only reset phase
          console.log('⚠️ Invalid transcript received from backend');
          setPhaseStatus('');
        } else if (msg.type === 'ai_thinking') {
          // Show AI processing indicator without adding to chat
          console.log('🤖 AI is processing response...');
          setPhaseStatus('AI is thinking...');
        } else if (msg.type === 'ended') {
          // Don't show "ENDED" in chat
          setPhaseStatus('');
          // Save results info if provided (optional - completion screen handles navigation)
          if (msg.interview_id && msg.download_url) {
            const resultsData = {
              interview_id: msg.interview_id,
              download_url: `${HTTP_BASE}${msg.download_url}`,
              timestamp: new Date().toISOString(),
              interview_type: 'resume'
            };
            localStorage.setItem('interviewResults', JSON.stringify(resultsData));
          }
          // DO NOT NAVIGATE - Let completion screen handle navigation flow
        } else if (msg.type === 'error') {
          // Don't show "ERROR:" in chat - only reset phase
          setPhaseStatus('');
        } else {
          addLog('MSG: ' + ev.data);
        }
      } catch (e) {
        console.error('❌ Error parsing WebSocket message:', e, ev.data);
        addLog(ev.data);
      }
    };
    } catch (e) {
      console.error('❌ WebSocket connection error:', e);
      setIsConnecting(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const uploadResume = async () => {
    if (!resumeFile) {
      setUploadMessage('Please select a PDF file first');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadMessage('');
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);
    
    const formData = new FormData();
    formData.append('file', resumeFile);
    
    try {
      const resp = await fetch(HTTP_BASE + '/upload_resume', {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!resp.ok) {
        setUploadMessage(`Upload failed: ${resp.status} ${resp.statusText}`);
        setIsUploading(false);
        return;
      }
      
      const data = await resp.json();
      setResumeId(data.resume_id);
      setResumeInfo(`Resume uploaded successfully (${data.pages} pages)`);
      setUploadMessage(`✅ Success! Resume uploaded (${data.pages} pages)`);
      
      // Clear progress after success
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1500);
      
    } catch (e) {
      clearInterval(progressInterval);
      setUploadMessage('❌ Upload failed. Please try again.');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const initResumeInterview = () => {
    console.log('🚀 initResumeInterview called, resumeId:', resumeId);
    
    // CRITICAL: Reset all input states before starting interview
    setAnswer('');
    setCode('');
    setIsTyping(false);
    setBlockVAD(false);
    setPhaseStatus('');
    
    // Force React to update and verify textarea is clear
    setTimeout(() => {
      const textarea = document.querySelector('textarea[placeholder*="response"]') as HTMLTextAreaElement;
      if (textarea && textarea.value.trim().length > 0) {
        console.warn('⚠️ Textarea not empty after init, forcing clear');
        textarea.value = '';
        setAnswer('');
      }
    }, 100);
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected. State:', wsRef.current?.readyState);
      // Don't add error to chat - silently fail and retry connection
      if (!isConnecting) {
        connectWebSocket();
      }
      return;
    }
    if (!resumeId) {
      console.error('❌ No resume ID');
      addLog('Upload resume first');
      return;
    }
    
    const initMessage = { 
      type: 'init', 
      mode: 'resume', 
      resume_id: resumeId 
    };
    
    console.log('📤 Sending init message:', initMessage);
    try {
      wsRef.current.send(JSON.stringify(initMessage));
      addLog('Init (resume)');
      setInterviewStarted(true);
      // Auto-start camera when interview begins
      startCamera();
    } catch (e) {
      console.error('Failed to send init message:', e);
      setIsConnected(false);
      connectWebSocket();
    }
  };

  const sendAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot send answer - WebSocket not connected');
      // Try to reconnect
      if (!isConnecting) {
        connectWebSocket();
      }
      return;
    }
    
    const userAnswer = answer.trim();
    if (!userAnswer) {
      console.log('⚠️ Empty answer, not sending');
      return;
    }
    
    // VALIDATION 1: Get last AI question for comparison
    const lastLog = logs[logs.length - 1] || '';
    const lastAIQuestion = lastLog.startsWith('Q:') ? lastLog.replace('Q: ', '').trim() : '';
    
    let cleanedAnswer = userAnswer;
    
    // VALIDATION 2: Check if answer contains or matches AI question
    if (lastAIQuestion && lastAIQuestion.length > 20) {
      // Check for exact prefix match (first 50 chars)
      const aiPrefix = lastAIQuestion.substring(0, 50).toLowerCase().trim();
      const answerPrefix = userAnswer.substring(0, Math.min(50, userAnswer.length)).toLowerCase().trim();
      
      // If answer starts with AI question, remove it
      if (answerPrefix === aiPrefix || answerPrefix.includes(aiPrefix)) {
        console.log('⚠️ Removing AI question prefix from answer');
        cleanedAnswer = userAnswer.replace(new RegExp('^' + lastAIQuestion.substring(0, 100), 'i'), '').trim();
      }
      
      // VALIDATION 3: Calculate similarity to detect if user copied AI question
      const similarity = calculateTextSimilarity(cleanedAnswer.length > 0 ? cleanedAnswer : userAnswer, lastAIQuestion);
      console.log(`📊 Answer similarity to AI question: ${(similarity * 100).toFixed(1)}%`);
      
      if (similarity > 0.7) { // 70% or more similar
        console.log('❌ REJECTED: Answer is too similar to AI question (likely copied)');
        setAnswer('');
        setPhaseStatus('⚠️ Please provide your own answer, not the question');
        setTimeout(() => setPhaseStatus(''), 3000);
        return;
      }
    }
    
    // VALIDATION 4: Final check - answer shouldn't be empty after cleaning
    if (!cleanedAnswer || cleanedAnswer.length < 2) {
      console.log('⚠️ Answer empty or too short after cleaning');
      setAnswer('');
      return;
    }
    
    // Show cleaned answer in chat immediately
    addLog('You: ' + cleanedAnswer);
    console.log('✅ Sending valid answer:', cleanedAnswer.substring(0, 50) + '...');
    
    try {
      wsRef.current.send(JSON.stringify({ 
        type: 'answer', 
        text: cleanedAnswer 
      }));
      
      // CRITICAL: Clear textarea immediately after sending
      setAnswer('');
      setIsTyping(false);
      setBlockVAD(false);
    } catch (e) {
      console.error('Failed to send answer:', e);
      setIsConnected(false);
    }
  };

  // Handle answer input change with typing detection
  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // CRITICAL CHECK: Detect if user is copying AI's question
    const lastLog = logs[logs.length - 1] || '';
    const lastAIQuestion = lastLog.startsWith('Q:') ? lastLog.replace('Q: ', '').trim() : '';
    
    if (lastAIQuestion && lastAIQuestion.length > 20 && value.length > 20) {
      // Check if value closely matches AI question (first 40 chars)
      const aiStart = lastAIQuestion.substring(0, 40).toLowerCase().trim();
      const valueStart = value.substring(0, 40).toLowerCase().trim();
      
      // If user typed text matches AI question start exactly
      if (valueStart === aiStart) {
        console.log('⚠️ BLOCKED: User appears to be copying AI question');
        setAnswer('');
        // Show brief warning without disrupting flow
        setPhaseStatus('⚠️ Please type your own response');
        setTimeout(() => setPhaseStatus(''), 2000);
        return;
      }
    }
    
    setAnswer(value);
    
    // IMMEDIATELY block VAD when typing starts
    setBlockVAD(true);
    setIsTyping(true);
    console.log('⛔ VAD BLOCKED - User is typing');
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // OPTIMIZED: Reduced timeout from 2000ms to 1500ms for faster response
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      setBlockVAD(false);
      console.log('✅ VAD unblocked - Typing stopped (1500ms timeout)');
      
      // If AI should be speaking but isn't, check state
      if (!isSpeaking && phase === 'Listening...') {
        console.log('🔊 Checking if VAD should restart');
        setTimeout(startServerVAD, 300);
      }
    }, 1500); // Reduced from 2000ms
  };

  const submitCode = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot submit code - WebSocket not connected');
      // Try to reconnect
      if (!isConnecting) {
        connectWebSocket();
      }
      return;
    }
    if (!code.trim()) {
      return;
    }
    
    // Show code submission in chat with preview
    const preview = code.length > 100 ? code.substring(0, 100) + '...' : code;
    addLog('You: [Code] ' + preview);
    setPhaseStatus('AI is analyzing your code...');
    
    try {
      wsRef.current.send(JSON.stringify({ 
        type: 'code_submission', 
        code: code 
      }));
      setCode('');
      setShowCodeEditor(false);
      setIsCodeMode(false);
    } catch (e) {
      console.error('Failed to submit code:', e);
      setIsConnected(false);
      setPhaseStatus('');
    }
  };

  const endInterview = () => {
    console.log('🚨 END INTERVIEW TRIGGERED - Starting comprehensive cleanup');
    
    // 1. IMMEDIATELY stop all voice/speech activities
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      console.log('🛑 Stopping all speech synthesis');
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
      
      // Force clear by speaking empty
      try {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
      } catch (e) { /* ignore */ }
    }

    // 2. Set ending flags to prevent reconnection and further processing
    setIsEndingInterview(true);
    setBlockVAD(true); // Block any further VAD
    
    // 3. Send FORCE STOP command to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const stopPayload = { 
          type: 'stop_interview',
          session_id: resumeId || `session_${Date.now()}`,
          timestamp: new Date().toISOString(),
          force_stop: true
        };
        console.log('📤 Sending force stop command:', stopPayload);
        wsRef.current.send(JSON.stringify(stopPayload));
        
        // Also send legacy 'end' message for compatibility
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'end' }));
          }
        }, 100);
      } catch (e) {
        console.error('Failed to send stop message:', e);
      }
    }
    
    // 4. Stop ALL media streams immediately
    console.log('🎥 Stopping camera and microphone');
    stopCamera();
    
    // 5. Force close WebSocket with proper close code
    if (wsRef.current) {
      console.log('🔌 Force closing WebSocket connection');
      try {
        wsRef.current.close(1000, "Interview ended by user");
      } catch (e) {
        console.error('Error closing WebSocket:', e);
      }
      wsRef.current = null;
    }
    
    // 6. Clear all input states
    console.log('🧹 Clearing all input states');
    setAnswer('');
    setCode('');
    setShowCodeEditor(false);
    setIsCodeMode(false);
    setPhaseStatus('');
    
    // 7. Clear ALL timeouts and intervals
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
      endTimeoutRef.current = null;
    }
    
    // Clear any global speech timeouts
    if (typeof window !== 'undefined') {
      const speechTimeouts = (window as any).__speechTimeouts || [];
      speechTimeouts.forEach(clearTimeout);
      (window as any).__speechTimeouts = [];
    }
    
    // 8. Save minimal session data
    const sessionData = {
      interviewType: 'resume',
      ended_at: new Date().toISOString(),
      manually_ended: true,
      messages_count: logs.length
    };
    
    try {
      localStorage.setItem('lastInterviewSession', JSON.stringify(sessionData));
      localStorage.removeItem('interviewResults');
      localStorage.removeItem('interviewSession');
    } catch (e) {
      console.warn('LocalStorage cleanup warning:', e);
    }
    
    // 9. Navigate to completion after SHORT delay (1 second only)
    endTimeoutRef.current = setTimeout(() => {
      console.log('✅ Interview cleanup complete, showing completion screen');
      setInterviewCompleted(true);
      setIsEndingInterview(false);
    }, 1000); // Reduced from 2500ms to 1000ms
  };

  useEffect(() => {
    // Auto-connect when component mounts
    connectWebSocket();
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle video stream assignment
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(console.error);
    }
  }, [cameraStream]);

  useEffect(() => {
    return () => {
      // Cleanup WebSocket
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Cleanup all timeouts
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  if (!interviewStarted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 relative"
      >
        {/* Back Button - Top Left */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10"
        >
          <Link 
            href="/interview" 
            className="inline-flex items-center space-x-2 text-purple-600 hover:text-purple-700 transition-all duration-200 hover:scale-105 bg-white/80 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2 rounded-full shadow-sm hover:shadow-md text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium hidden sm:inline">Back to Selection</span>
            <span className="font-medium sm:hidden">Back</span>
          </Link>
        </motion.div>

        <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 pt-16 sm:pt-20">
          <div className="max-w-4xl mx-auto text-center w-full">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-8 sm:mb-10 lg:mb-12 px-4 sm:px-0"
            >            
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 sm:mb-4"
            >
              Resume-based{' '}
              <span className="bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                Interview
              </span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto px-4 sm:px-0"
            >
              Upload your resume to get personalized questions based on your experience and projects
            </motion.p>
          </motion.div>

          {/* Resume Upload */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="bg-white rounded-2xl lg:rounded-3xl shadow-xl border border-gray-100 p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto hover:shadow-2xl transition-all duration-300"
          >
            <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <span className="text-gray-900 text-center sm:text-left">Upload Your Resume</span>
            </h3>
            
            <div className="space-y-4 sm:space-y-6">
              {/* File Upload Area */}
              <div className="relative border-2 border-dashed border-purple-200 rounded-xl p-6 sm:p-8 lg:p-10 text-center hover:border-purple-400 transition-all duration-300 bg-gradient-to-br from-purple-50/50 via-white to-violet-50/50 hover:shadow-md group">
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                  }}
                  transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatType: "loop",
                    ease: "easeInOut"
                  }}
                  className="relative z-10"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-purple-100 to-violet-100 rounded-full flex items-center justify-center group-hover:from-purple-200 group-hover:to-violet-200 transition-all duration-300">
                    <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-purple-500 group-hover:text-purple-600 transition-colors duration-300" />
                  </div>
                </motion.div>
                
                <div className="space-y-3 sm:space-y-4 relative z-10">
                  <div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      id="resume-upload"
                      className="hidden"
                    />
                    <label 
                      htmlFor="resume-upload"
                      className="inline-flex items-center space-x-2 px-5 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg sm:rounded-xl font-medium hover:from-purple-700 hover:to-violet-700 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg text-sm sm:text-base min-h-[50px] touch-manipulation"
                    >
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                      <span>Choose File</span>
                    </label>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm sm:text-base font-medium text-gray-700 mb-1">
                      Upload your PDF resume (Max 10MB)
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 px-4 sm:px-0">
                      Drag & drop or click to browse • PDF format only
                    </p>
                  </div>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute top-4 right-4 w-8 h-8 bg-purple-100 rounded-full opacity-50"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 bg-violet-100 rounded-full opacity-30"></div>
              </div>
              
              {/* Selected File Display */}
              {resumeFile && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-violet-500/5"></div>
                  <div className="relative p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 mb-1 text-sm sm:text-base truncate">{resumeFile.name}</p>
                        <p className="text-xs sm:text-sm text-gray-600">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB • PDF Document</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={uploadResume}
                      disabled={isUploading}
                      className="w-full sm:w-auto px-5 py-3 sm:px-6 sm:py-3.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-violet-700 transition-all duration-200 disabled:from-purple-400 disabled:to-violet-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-sm hover:shadow-lg text-sm sm:text-base min-h-[50px] touch-manipulation flex-shrink-0"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin flex-shrink-0" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>Upload Resume</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Progress Bar */}
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-4 sm:p-6 border border-purple-200"
                >
                  <div className="flex justify-between items-center mb-2 sm:mb-3">
                    <span className="text-gray-700 font-medium text-sm sm:text-base">Processing your resume...</span>
                    <span className="text-purple-600 font-semibold text-base sm:text-lg">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-2.5 sm:h-3 overflow-hidden shadow-inner">
                    <motion.div
                      className="h-2.5 sm:h-3 bg-gradient-to-r from-purple-500 via-purple-600 to-violet-600 rounded-full shadow-sm"
                      initial={{ width: "0%" }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Upload Messages */}
              {uploadMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`relative overflow-hidden rounded-2xl p-4 sm:p-6 shadow-lg ${
                    uploadMessage.includes('Success') || uploadMessage.includes('successfully')
                      ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-emerald-200'
                      : 'bg-gradient-to-br from-red-50 via-pink-50 to-rose-50 border-2 border-red-200'
                  }`}
                >
                  {/* Background decoration */}
                  <div className={`absolute inset-0 opacity-5 ${
                    uploadMessage.includes('Success') || uploadMessage.includes('successfully')
                      ? 'bg-gradient-to-br from-emerald-500 to-green-500'
                      : 'bg-gradient-to-br from-red-500 to-pink-500'
                  }`}></div>
                  
                  <div className="relative flex items-center space-x-3 sm:space-x-4">
                    {uploadMessage.includes('Success') || uploadMessage.includes('successfully') ? (
                      <motion.div 
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <CheckCircle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white flex items-center justify-center">
                          <span className="text-red-600 text-base sm:text-lg font-bold">!</span>
                        </div>
                      </motion.div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <motion.p 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className={`text-base sm:text-lg font-semibold mb-1 ${
                          uploadMessage.includes('Success') || uploadMessage.includes('successfully')
                            ? 'text-emerald-800'
                            : 'text-red-800'
                        }`}
                      >
                        {uploadMessage.includes('Success') || uploadMessage.includes('successfully')
                          ? 'Upload Successful!'
                          : 'Upload Failed'
                        }
                      </motion.p>
                      <motion.p 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className={`text-xs sm:text-sm break-words ${
                          uploadMessage.includes('Success') || uploadMessage.includes('successfully')
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {uploadMessage}
                      </motion.p>
                    </div>
                  </div>
                  
                  {/* Success confetti effect */}
                  {uploadMessage.includes('Success') || uploadMessage.includes('successfully') && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, duration: 0.3 }}
                        className="absolute top-2 right-2 w-2 h-2 bg-emerald-400 rounded-full"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6, duration: 0.3 }}
                        className="absolute top-6 right-6 w-1.5 h-1.5 bg-green-400 rounded-full"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, duration: 0.3 }}
                        className="absolute bottom-3 right-3 w-1 h-1 bg-teal-400 rounded-full"
                      />
                    </>
                  )}
                </motion.div>
              )}
              
              {/* Upload Success - Remove this duplicate since uploadMessage handles it */}
              {resumeInfo && !isUploading && !uploadMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 shadow-sm border-l-4 border-l-green-500"
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="font-medium text-green-800">{resumeInfo}</p>
                  </div>
                </motion.div>
              )}
              
              {/* Start Interview Button */}
              <div className="relative">
                <motion.button
                  whileHover={{ 
                    scale: !resumeId || !isConnected ? 1 : 1.02,
                    boxShadow: !resumeId || !isConnected ? "none" : "0 0 20px rgba(124, 58, 237, 0.4)"
                  }}
                  whileTap={{ scale: !resumeId || !isConnected ? 1 : 0.98 }}
                  onClick={initResumeInterview}
                  disabled={!resumeId || !isConnected}
                  className={`w-full px-8 py-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-3 ${
                    !resumeId || !isConnected
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  <Play className="w-5 h-5" />
                  <span>Start Resume Interview</span>
                </motion.button>
                
                {/* Tooltip for disabled state */}
                {(!resumeId || !isConnected) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap"
                  >
                    {!resumeId ? 'Please upload a resume first' : 'Connecting to AI interviewer...'}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-2 bg-gray-800 rotate-45"></div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Connection Status */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-center space-x-2">
                {isConnected ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-600 font-medium">Connected to AI Interviewer</span>
                  </motion.div>
                ) : isConnecting ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2"
                  >
                    <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                    <span className="text-sm text-gray-600 font-medium">Connecting to AI...</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center space-x-2"
                  >
                    <div className="w-5 h-5 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-600 font-medium">Connection Failed</span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
        </div>
      </motion.div>
    );
  }

  // Loading screen when ending interview
  if (isEndingInterview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-violet-50 overflow-hidden">
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
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Completion screen
  if (interviewCompleted) {
    const handleReturn = () => {
      setIsExiting(true);  // Start exit animation
      
      // Wait for animation to complete (500ms) THEN navigate
      setTimeout(() => {
        // RESET ALL STATES before navigating
        setIsEndingInterview(false);
        setInterviewCompleted(false);
        setInterviewStarted(false);
        setResumeId(null);
        setResumeFile(null);
        setLogs([]);
        setAnswer('');
        setCode('');
        
        // Clear any stored data
        localStorage.removeItem('lastInterviewSession');
        localStorage.removeItem('interviewResults');
        localStorage.removeItem('interviewSession');
        
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

  // Interview Console View
  return (
    <div className="bg-gray-900 flex flex-col" style={{ height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Main container: Use flex-col on mobile for vertical stacking, flex-row on desktop */}
      <div className={`flex ${isMobile ? 'flex-col h-full' : 'flex-1'} overflow-hidden`}>
      {/* Main Video Area - ABSOLUTELY FIXED on mobile, no scroll */}
      <div 
        className={`
          bg-gray-800
          ${isMobile 
            ? 'absolute top-0 left-0 right-0 z-10' 
            : 'relative flex-1'
          }
        `}
        style={{
          ...(isMobile 
            ? { 
                height: '45vh',
                touchAction: 'none',
                overflow: 'hidden',
                position: 'absolute'
              } 
            : { 
                width: `calc(100% - ${showChatPanel ? chatPanelWidth : 0}px)`,
                minHeight: '400px',
                position: 'relative'
              }
          )
        }}
      >
        {/* Background: user's camera video (full screen) - prevent zoom */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900" style={{ touchAction: 'none' }}>
          {isCameraOn && cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain bg-black"
              style={{ 
                pointerEvents: 'none',
                transform: 'scale(1.0)',
                transformOrigin: 'center center',
                touchAction: 'none'
              }}
              onLoadedData={() => console.log('Video loaded')}
              onError={(e) => console.error('Video error:', e)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white px-4">
                <div className="mb-4 sm:mb-8">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full bg-gray-700 flex items-center justify-center mb-3 sm:mb-4">
                    {/* Simple person silhouette SVG as placeholder for user */}
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="12" cy="8" r="3.6" fill="#CBD5E1" />
                      <path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6" fill="#E2E8F0" />
                    </svg>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-semibold mb-1 sm:mb-2">Interview in Progress</h2>
                  <p className="text-sm sm:text-base text-gray-300">Having a conversation with CodeSage AI</p>
                  <div className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-200">You (camera off)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Minimized AI Tile (top-right) - Responsive */}
        <div className={`absolute ${isMobile ? 'top-3 right-3' : 'top-6 right-6'} z-30`}>
          <div className={`${isMobile ? 'w-32 h-20' : 'w-40 h-24'} rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg flex items-center`}>
            <div className={`${isMobile ? 'w-20' : 'w-24'} h-full bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center`}>
              <div className={`text-white font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>AI</div>
            </div>
            <div className="flex-1 p-2">
              <div className={`${isMobile ? 'text-xs' : 'text-sm'} text-white font-semibold`}>CodeSage</div>
              <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-white/80`}>Virtual Interviewer</div>
            </div>
          </div>
        </div>

        {/* Bottom Controls Bar - Responsive */}
        <div className={`absolute ${isMobile ? 'bottom-4 left-1/2 transform -translate-x-1/2 flex-col space-y-2' : 'bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4'} bg-black/40 backdrop-blur-md rounded-full ${isMobile ? 'px-4 py-2' : 'px-6 py-3'} shadow-xl`}>
          <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-4'}`}>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleCamera}
              aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
              className={`${isMobile ? 'p-2' : 'p-3'} rounded-full transition-colors min-h-[50px] min-w-[50px] flex items-center justify-center touch-manipulation ${
                isCameraOn 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-500 text-white'
              }`}
            >
            {/* Show Camera icon when camera is ON (indicates live), and CameraOff when OFF */}
            {isCameraOn ? <Camera className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} /> : <CameraOff className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: isEndingInterview ? 1 : 1.05 }}
            whileTap={{ scale: isEndingInterview ? 1 : 0.95 }}
            onClick={endInterview}
            disabled={isEndingInterview}
            className={`bg-red-600 hover:bg-red-700 text-white ${isMobile ? 'px-4 py-2 text-sm' : 'px-6 py-3'} rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 min-h-[50px] touch-manipulation`}
          >
            {isEndingInterview ? 'Ending...' : 'End Interview'}
          </motion.button>
        </div>
        </div>

        {/* Top Header Bar - Responsive */}
        <div className={`absolute top-0 left-0 right-0 ${isMobile ? 'p-3' : 'p-6'}`}>
          <div className={`flex items-center ${isMobile ? 'flex-col space-y-2' : 'justify-between'}`}>
            <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-3'} bg-black/50 backdrop-blur-md rounded-full ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'}`}>
              <FileText className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-purple-400`} />
              <span className={`text-white font-medium ${isMobile ? 'text-sm' : ''}`}>CodeSage - Resume Interview</span>
            </div>
            
            <div className={`flex items-center space-x-2 bg-purple-500/20 backdrop-blur-md rounded-full ${isMobile ? 'px-2 py-1' : 'px-3 py-2'}`}>
              <CheckCircle className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-purple-400`} />
              <span className={`text-purple-300 ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>AI Connected</span>
            </div>
          </div>
        </div>

        {/* User Name Label - Responsive */}
        <div className={`absolute ${isMobile ? 'bottom-20' : 'bottom-20'} ${isMobile ? 'left-3' : 'left-6'}`}>
          <div className={`bg-black/60 backdrop-blur-sm text-white ${isMobile ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} rounded-lg font-medium`}>
            You
          </div>
        </div>

        {/* Phase Status Indicator */}
        {phase && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute ${isMobile ? 'top-20 left-1/2 -translate-x-1/2' : 'top-24 left-1/2 -translate-x-1/2'} bg-cyan-500/20 backdrop-blur-sm ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-full border border-cyan-500/30 z-20`}
          >
            <p className={`text-cyan-300 ${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{phase}</p>
          </motion.div>
        )}
        
        {/* VAD Blocked Indicator - Show when typing */}
        {(isTyping || blockVAD) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute ${isMobile ? 'top-32 left-1/2 -translate-x-1/2' : 'top-36 left-1/2 -translate-x-1/2'} bg-yellow-500/20 backdrop-blur-sm ${isMobile ? 'px-3 py-1.5' : 'px-4 py-2'} rounded-full border border-yellow-500/30 z-20`}
          >
            <p className={`text-yellow-300 ${isMobile ? 'text-xs' : 'text-sm'} font-medium flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
              <span>⛔</span>
              <span>Voice Input Paused - Typing</span>
            </p>
          </motion.div>
        )}
      </div>

      {/* Resize Handle - Hide on mobile */}
      {!isMobile && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors ${
            isResizing ? 'bg-blue-500' : ''
          }`}
        />
      )}

      {/* Right Side - Chat Transcript Panel - Positioned below video on mobile */}
      <div 
        className={`
          bg-white flex flex-col
          ${isMobile 
            ? 'absolute bottom-0 left-0 right-0 border-t-2 border-gray-300 shadow-lg' 
            : 'relative border-l border-gray-300'
          }
        `}
        style={{
          ...(isMobile 
            ? { 
                top: '45vh',
                height: '55vh',
                overflow: 'hidden'
              } 
            : { 
                width: `${chatPanelWidth}px`
              }
          )
        }}
      >
        {/* Chat Header - Responsive */}
        <div className={`${isMobile ? 'p-3 pb-2' : 'p-4'} border-b border-gray-200 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageSquare className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-purple-600`} />
              <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900`}>Live Transcript</h3>
            </div>
            <div className="flex items-center space-x-2">
              {phase && (
                <div className={`flex items-center space-x-1.5 ${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'} text-blue-600 bg-blue-50 rounded-full font-medium`}>
                  {phase === 'Listening...' && <Loader2 className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} animate-spin`} />}
                  {phase === 'Speaking...' && <Mic className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />}
                  <span>{phase}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat Messages - Responsive */}
        <div className={`flex-1 overflow-y-auto ${isMobile ? 'p-3' : 'p-4'} ${isMobile ? 'space-y-3' : 'space-y-4'}`}>
          {logs.map((log, index) => {
            // Determine message type - ONLY messages starting with "You:" are user messages
            const isUser = log.startsWith('You:');
            const isQuestion = log.startsWith('Q:');
            const isEvaluation = log.startsWith('Evaluation:');
            const isHint = log.startsWith('Hint:');
            const isSystem = log.startsWith('MSG:') || log.startsWith('Init');
            
            // Clean up the message text
            let cleanMessage = log;
            if (isQuestion) cleanMessage = log.replace('Q: ', '');
            if (isEvaluation) cleanMessage = log.replace('Evaluation: ', '');
            if (isHint) cleanMessage = log.replace('Hint: ', '');
            if (isUser) cleanMessage = log.replace('You: ', '');
            if (isSystem && log.startsWith('MSG: ')) cleanMessage = log.replace('MSG: ', '');

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`${isMobile ? 'max-w-[85%]' : 'max-w-xs'} ${isMobile ? 'px-3 py-2' : 'px-4 py-3'} rounded-2xl shadow-sm ${
                  isUser 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white ml-auto' 
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                }`}>
                  {/* Show "AI Interviewer" label for AI messages (not user, not system) */}
                  {!isUser && !isSystem && (
                    <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-gray-600 mb-1 font-semibold`}>
                      AI Interviewer
                    </div>
                  )}
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} ${isUser ? 'text-white' : 'text-gray-900'} break-words`}>
                    {cleanMessage}
                  </p>
                  {/* Show "You" label for user messages */}
                  {isUser && (
                    <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-cyan-100 mt-1 text-right opacity-80`}>
                      You
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Message Input - Responsive */}
        <div className={`${isMobile ? 'p-3' : 'p-4'} border-t border-gray-200 flex-shrink-0`}>
          {showCodeEditor ? (
            /* Code Editor Mode */
            <div className={`${isMobile ? 'space-y-2' : 'space-y-3'}`}>
              <div className="flex items-center space-x-2">
                <Code2 className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-blue-600`} />
                <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-gray-700`}>Code Editor</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Write your code here..."
                className={`w-full ${isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono placeholder-gray-600 placeholder-opacity-100 text-gray-800`}
                rows={isMobile ? 6 : 10}
                style={{ fontFamily: 'Monaco, Consolas, "Lucida Console", monospace' }}
              />
              <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'space-x-2'}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitCode}
                  disabled={!code.trim()}
                  className={`${isMobile ? 'w-full px-3 py-2 text-sm' : 'px-4 py-2'} bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-h-[50px] touch-manipulation`}
                >
                  <Send className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                  <span>Submit Code</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCode('')}
                  className={`${isMobile ? 'w-full px-3 py-2 text-sm' : 'px-4 py-2'} bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors min-h-[50px] touch-manipulation`}
                >
                  Clear
                </motion.button>
              </div>
            </div>
          ) : (
            /* Regular Text Input Mode */
            <div className={`${isMobile ? 'space-y-2' : 'space-y-2'}`}>
              <div className={`flex ${isMobile ? 'space-x-2' : 'space-x-2'}`}>
                <textarea
                  value={answer}
                  onChange={handleAnswerChange}
                  onFocus={() => {
                    console.log('⛔ Textarea focused - Blocking VAD immediately');
                    setIsTyping(true);
                    setBlockVAD(true); // Immediately block VAD when textarea gets focus
                  }}
                  onBlur={() => {
                    console.log('👁️ Textarea blurred - Clearing typing state');
                    // Clear typing state and timeout on blur
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = null;
                    }
                    setIsTyping(false);
                    // Don't immediately unblock - wait a moment to be safe
                    setTimeout(() => {
                      setBlockVAD(false);
                      console.log('✅ VAD unblocked after blur delay');
                    }, 1000);
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && answer.trim()) {
                      e.preventDefault();
                      sendAnswer();
                    }
                  }}
                  placeholder="Type your response..."
                  className={`flex-1 ${isMobile ? 'px-3 py-2.5 text-base min-h-[44px]' : 'px-3 py-2 text-sm'} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-500 text-gray-800`}
                  rows={isMobile ? 1 : 2}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendAnswer}
                  disabled={!answer.trim()}
                  className={`${isMobile ? 'px-4' : 'px-4 py-2'} bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed self-end min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation shadow-sm`}
                >
                  <Send className="w-5 h-5" />
                </motion.button>
              </div>
              
              {/* Visual Warning: Show if answer is suspiciously similar to AI question */}
              {answer.trim().length > 20 && logs.length > 0 && (() => {
                const lastLog = logs[logs.length - 1] || '';
                const lastAIQuestion = lastLog.startsWith('Q:') ? lastLog.replace('Q: ', '').trim() : '';
                
                if (lastAIQuestion && lastAIQuestion.length > 20) {
                  const similarity = calculateTextSimilarity(answer, lastAIQuestion);
                  if (similarity > 0.4) { // 40% or more similar - show warning
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`${isMobile ? 'text-xs px-2 py-1.5' : 'text-sm px-3 py-2'} text-amber-600 flex items-center gap-1.5 bg-amber-50 rounded border border-amber-200`}
                      >
                        <span>⚠️</span>
                        <span className="font-medium">Make sure you're typing your own response, not the question</span>
                      </motion.div>
                    );
                  }
                }
                return null;
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}