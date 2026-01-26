'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import TypewriterIntro from '../components/TypewriterIntro';
import Hero from '../components/Hero';
import './home.css';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    
    // Check if typewriter has already been shown in this session
    const hasSeenTypewriter = sessionStorage.getItem('hasSeenTypewriter');
    
    if (!hasSeenTypewriter && user) {
      setShowTypewriter(true);
    }
    setIsLoading(false);
  }, [user, authLoading, router]);

  const handleTypewriterComplete = () => {
    // Mark typewriter as seen for this session
    sessionStorage.setItem('hasSeenTypewriter', 'true');
    setShowTypewriter(false);
  };

  const handleTakeInterview = () => {
    router.push('/interview');
  };

  const handleViewResults = () => {
    router.push('/interview/results');
  };

  const handleGoHome = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading state briefly to prevent flash
  if (isLoading || authLoading) {
    return (
      <div className="home-page light-mode" style={{background: '#ffffff', minHeight: '100vh'}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return null;
  }

  if (showTypewriter) {
    return (
      <div className="home-page light-mode" style={{background: '#ffffff', minHeight: '100vh'}}>
        <TypewriterIntro onComplete={handleTypewriterComplete} />
      </div>
    );
  }

  return (
    <div className="home-page light-mode" style={{background: '#ffffff', minHeight: '100vh'}}>
      <Hero 
        onTakeInterview={handleTakeInterview}
        onViewResults={handleViewResults}
        onGoHome={handleGoHome}
      />
    </div>
  );
}
