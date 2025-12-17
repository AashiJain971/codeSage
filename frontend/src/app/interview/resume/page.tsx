'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../../../components/Navbar';
import { FileText, Upload, Mic, CheckCircle, Loader2, Play, ArrowLeft, Camera, CameraOff, Code2, Send } from 'lucide-react';
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
  
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const endTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const HTTP_BASE = 'http://127.0.0.1:8000';
  const WS_URL = 'ws://127.0.0.1:8000/ws';

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const setPhaseStatus = (text: string) => {
    setPhase(text);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setCameraStream(stream);
      setIsCameraOn(true);
      
      // Ensure video element gets the stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Force video to play
        videoRef.current.play().catch(console.error);
      }
      
      addLog('Camera started successfully');
    } catch (error) {
      console.error('Error accessing camera:', error);
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

  const startServerVAD = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setPhaseStatus('Listening...');
    wsRef.current.send(JSON.stringify({ type: 'record_audio' }));
  };

  const speakAndThenRecord = (text: string) => {
    if (!text || !text.trim()) return;
    setPhaseStatus('Speaking...');
    try {
      if (!('speechSynthesis' in window)) {
        setTimeout(startServerVAD, 400);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        startServerVAD();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        startServerVAD();
      };
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsSpeaking(false);
      startServerVAD();
    }
  };

  const connectWebSocket = async () => {
    setIsConnecting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    wsRef.current = new WebSocket(WS_URL);
    
    wsRef.current.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      // Don't show "WS connected" in chat
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      // Don't show "WS closed" in chat
      try {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      } catch {}
      setPhaseStatus('');
    };

    wsRef.current.onerror = (e) => {
      setIsConnecting(false);
      // Don't show "WS error occurred" in chat
    };

    wsRef.current.onmessage = (ev) => {
      try {
        const msg: WebSocketMessage = JSON.parse(ev.data);
        
        if (msg.type === 'ready') {
          // Don't show "READY:" in chat - only process question
          if (msg.next_question) {
            addLog('Q: ' + msg.next_question);
            
            // Check if this is a coding question
            const isCodingQuestion = /write.*code|implement|function|algorithm|program|solve.*problem|code.*solution/i.test(msg.next_question);
            setIsCodeMode(isCodingQuestion);
            setShowCodeEditor(isCodingQuestion);
            
            if (isCodingQuestion) {
              setPhaseStatus('Please write your code and click Submit when ready');
              // For coding questions, don't auto-start recording
            } else {
              speakAndThenRecord(msg.next_question);
            }
          }
        } else if (msg.type === 'assessment') {
          // Don't show evaluation, hint, or final_feedback in UI - only store in backend JSON
          if (msg.next_question) {
            addLog('Q: ' + msg.next_question);
            
            // Check if this is a coding question
            const isCodingQuestion = /write.*code|implement|function|algorithm|program|solve.*problem|code.*solution/i.test(msg.next_question);
            setIsCodeMode(isCodingQuestion);
            setShowCodeEditor(isCodingQuestion);
            
            if (isCodingQuestion) {
              setPhaseStatus('Please write your code and click Submit when ready');
              // For coding questions, don't auto-start recording
            } else {
              speakAndThenRecord(msg.next_question);
            }
          } else {
            setPhaseStatus('');
            setShowCodeEditor(false);
            setIsCodeMode(false);
          }
        } else if (msg.type === 'listening') {
          // Don't show "LISTENING:" in chat - only set phase
          setPhaseStatus('Listening...');
        } else if (msg.type === 'transcribed') {
          // Show user's transcript in chat
          if (msg.transcript) {
            addLog('You: ' + msg.transcript);
          }
          setAnswer(msg.transcript || '');
          setPhaseStatus('');
        } else if (msg.type === 'no_speech') {
          // Don't show "NO SPEECH:" in chat - only reset phase
          setPhaseStatus('');
        } else if (msg.type === 'invalid_transcript') {
          // Don't show "INVALID:" in chat - only reset phase
          setPhaseStatus('');
        } else if (msg.type === 'ended') {
          // Don't show "ENDED" in chat
          setPhaseStatus('');
          // Save results info if provided (optional - completion screen handles navigation)
          if (msg.interview_id && msg.download_url) {
            const resultsData = {
              interview_id: msg.interview_id,
              download_url: `http://127.0.0.1:8000${msg.download_url}`,
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
        addLog(ev.data);
      }
    };
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
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      // Don't show "Connect WS first" in chat
      return;
    }
    if (!resumeId) {
      addLog('Upload resume first');
      return;
    }
    wsRef.current.send(JSON.stringify({ 
      type: 'init', 
      mode: 'resume', 
      resume_id: resumeId 
    }));
    addLog('Init (resume)');
    setInterviewStarted(true);
    // Auto-start camera when interview begins
    startCamera();
  };

  const sendAnswer = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('Connect WS first');
      return;
    }
    if (!answer.trim()) {
      addLog('Answer empty');
      return;
    }
    wsRef.current.send(JSON.stringify({ 
      type: 'answer', 
      text: answer 
    }));
    setAnswer('');
  };

  const submitCode = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('Connect WS first');
      return;
    }
    if (!code.trim()) {
      addLog('Code empty');
      return;
    }
    
    addLog('A: [Code Submitted]');
    setPhaseStatus('AI is analyzing your code...');
    
    wsRef.current.send(JSON.stringify({ 
      type: 'code_submission', 
      code: code 
    }));
    setCode('');
    setShowCodeEditor(false);
    setIsCodeMode(false);
  };

  const endInterview = () => {
    // Stop any ongoing speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.pause();
    }

    // Send end interview message to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    
    // Show loading screen IMMEDIATELY
    setIsEndingInterview(true);
    stopCamera();
    
    // Save minimal session data to localStorage (avoid quota exceeded error)
    const sessionData = {
      interviewType: 'resume',
      timestamp: new Date().toISOString(),
      messages: logs.slice(-20) // Keep only last 20 messages to avoid storage quota
    };
    
    try {
      localStorage.setItem('lastInterviewSession', JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
    
    // Clear any existing timeout first
    if (endTimeoutRef.current) {
      clearTimeout(endTimeoutRef.current);
    }
    
    // ONE SINGLE TIMEOUT: Exactly 2.5 seconds total
    endTimeoutRef.current = setTimeout(() => {
      setIsEndingInterview(false);
      setInterviewCompleted(true);
      
      // Close WebSocket immediately (no extra timeout)
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      
      // Clear timeout ref
      endTimeoutRef.current = null;
    }, 2500); // EXACTLY 2.5 seconds - no nested timeouts
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
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Cleanup timeout on unmount
      if (endTimeoutRef.current) {
        clearTimeout(endTimeoutRef.current);
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

        <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 pt-16 sm:pt-20">
          <div className="max-w-4xl mx-auto text-center w-full">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mb-12"
            >            
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl font-bold text-gray-900 mb-4"
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
              className="text-xl text-gray-600 max-w-2xl mx-auto"
            >
              Upload your resume to get personalized questions based on your experience and projects
            </motion.p>
          </motion.div>

          {/* Resume Upload */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 max-w-2xl mx-auto hover:shadow-2xl transition-all duration-300"
          >
            <h3 className="text-2xl font-bold mb-8 flex items-center justify-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-500 rounded-full flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <span className="text-gray-900">Upload Your Resume</span>
            </h3>
            
            <div className="space-y-6">
              {/* File Upload Area */}
              <div className="relative border-2 border-dashed border-purple-200 rounded-xl p-8 text-center hover:border-purple-400 transition-all duration-300 bg-gradient-to-br from-purple-50/50 via-white to-violet-50/50 hover:shadow-md group">
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
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-violet-100 rounded-full flex items-center justify-center group-hover:from-purple-200 group-hover:to-violet-200 transition-all duration-300">
                    <Upload className="w-10 h-10 text-purple-500 group-hover:text-purple-600 transition-colors duration-300" />
                  </div>
                </motion.div>
                
                <div className="space-y-4 relative z-10">
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
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-violet-700 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-lg"
                    >
                      <FileText className="w-5 h-5" />
                      <span>Choose File</span>
                    </label>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-base font-medium text-gray-700 mb-1">
                      Upload your PDF resume (Max 10MB)
                    </p>
                    <p className="text-sm text-gray-500">
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
                  <div className="relative p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg flex items-center justify-center shadow-sm">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 mb-1">{resumeFile.name}</p>
                        <p className="text-sm text-gray-600">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB • PDF Document</p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={uploadResume}
                      disabled={isUploading}
                      className="px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-violet-700 transition-all duration-200 disabled:from-purple-400 disabled:to-violet-400 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-lg"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
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
                  className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-700 font-medium">Processing your resume...</span>
                    <span className="text-purple-600 font-semibold text-lg">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-3 overflow-hidden shadow-inner">
                    <motion.div
                      className="h-3 bg-gradient-to-r from-purple-500 via-purple-600 to-violet-600 rounded-full shadow-sm"
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
                  className={`relative overflow-hidden rounded-2xl p-6 shadow-lg ${
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
                  
                  <div className="relative flex items-center space-x-4">
                    {uploadMessage.includes('Success') || uploadMessage.includes('successfully') ? (
                      <motion.div 
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <CheckCircle className="w-7 h-7 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                        className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg"
                      >
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                          <span className="text-red-600 text-lg font-bold">!</span>
                        </div>
                      </motion.div>
                    )}
                    
                    <div className="flex-1">
                      <motion.p 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className={`text-lg font-semibold mb-1 ${
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
                        className={`text-sm ${
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
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar theme="dark" />
      <div className="flex-1 flex">
      {/* Main Video Area - Left Side */}
      <div className="flex-1 relative" style={{ width: `calc(100% - ${chatPanelWidth}px)` }}>
        {/* Background: user's camera video (full screen) */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
          {isCameraOn && cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              onLoadedData={() => console.log('Video loaded')}
              onError={(e) => console.error('Video error:', e)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="mb-8">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gray-700 flex items-center justify-center mb-4">
                    {/* Simple person silhouette SVG as placeholder for user */}
                    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <circle cx="12" cy="8" r="3.6" fill="#CBD5E1" />
                      <path d="M4 20c0-3.3137 2.6863-6 6-6h4c3.3137 0 6 2.6863 6 6" fill="#E2E8F0" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Interview in Progress</h2>
                  <p className="text-gray-300">Having a conversation with CodeSage AI</p>
                  <div className="mt-3 text-sm text-gray-200">You (camera off)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Minimized AI Tile (top-right) */}
        <div className="absolute top-6 right-6 z-30">
          <div className="w-40 h-24 rounded-xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg flex items-center">
            <div className="w-24 h-full bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center">
              <div className="text-white font-bold text-2xl">AI</div>
            </div>
            <div className="flex-1 p-2">
              <div className="text-sm text-white font-semibold">CodeSage</div>
              <div className="text-xs text-white/80">Virtual Interviewer</div>
            </div>
          </div>
        </div>

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/40 backdrop-blur-md rounded-full px-6 py-3 shadow-xl">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleCamera}
            aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
            className={`p-3 rounded-full transition-colors ${
              isCameraOn 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            {/* Show Camera icon when camera is ON (indicates live), and CameraOff when OFF */}
            {isCameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: isEndingInterview ? 1 : 1.05 }}
            whileTap={{ scale: isEndingInterview ? 1 : 0.95 }}
            onClick={endInterview}
            disabled={isEndingInterview}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isEndingInterview ? 'Ending...' : 'End Interview'}
          </motion.button>
        </div>

        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 bg-black/50 backdrop-blur-md rounded-full px-4 py-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <span className="text-white font-medium">CodeSage - Resume Interview</span>
            </div>
            
            <div className="flex items-center space-x-2 bg-purple-500/20 backdrop-blur-md rounded-full px-3 py-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 text-sm font-medium">AI Connected</span>
            </div>
          </div>
        </div>

        {/* User Name Label */}
        <div className="absolute bottom-20 left-6">
          <div className="bg-black/60 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-sm font-medium">
            You
          </div>
        </div>
      </div>

      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={handleMouseDown}
        className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors ${
          isResizing ? 'bg-blue-500' : ''
        }`}
      />

      {/* Right Side - Chat Transcript Panel */}
      <div className="bg-white flex flex-col" style={{ width: `${chatPanelWidth}px` }}>
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Live Transcript</h3>
            {phase && (
              <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                {phase === 'Listening...' && <Loader2 className="w-4 h-4 animate-spin" />}
                {phase === 'Speaking...' && <Mic className="w-4 h-4" />}
                <span>{phase}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {logs.map((log, index) => {
            const isQuestion = log.startsWith('Q:');
            const isEvaluation = log.startsWith('Evaluation:');
            const isHint = log.startsWith('Hint:');
            const isTranscribed = log.startsWith('TRANSCRIBED:');
            const isUser = isTranscribed;
            
            // Clean up the message text
            let cleanMessage = log;
            if (isQuestion) cleanMessage = log.replace('Q: ', '');
            if (isEvaluation) cleanMessage = log.replace('Evaluation: ', '');
            if (isHint) cleanMessage = log.replace('Hint: ', '');
            if (isTranscribed) cleanMessage = log.replace('TRANSCRIBED: ', '');

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs px-4 py-2 rounded-2xl ${
                  isUser 
                    ? 'bg-cyan-600 text-white ml-auto shadow-md' 
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  {!isUser && (
                    <div className="text-xs text-gray-500 mb-1 font-medium">
                      Alex
                    </div>
                  )}
                  <p className={`text-sm ${isUser ? 'text-white' : 'text-gray-900'}`}>
                    {cleanMessage}
                  </p>
                  {isUser && (
                    <div className="text-xs text-blue-100 mt-1 text-right">
                      Aaron Wang
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          <div ref={logsEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          {showCodeEditor ? (
            /* Code Editor Mode */
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Code Editor</span>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Write your code here..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm placeholder-gray-600 placeholder-opacity-100 text-gray-800"
                rows={10}
                style={{ fontFamily: 'Monaco, Consolas, "Lucida Console", monospace' }}
              />
              <div className="flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={submitCode}
                  disabled={!code.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Submit Code</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCode('')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600 transition-colors"
                >
                  Clear
                </motion.button>
              </div>
            </div>
          ) : (
            /* Regular Text Input Mode */
            <div className="flex space-x-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your response..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm placeholder-gray-600 placeholder-opacity-100 text-gray-800"
                rows={2}
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={sendAnswer}
                disabled={!answer.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed self-end"
              >
                Send
              </motion.button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}