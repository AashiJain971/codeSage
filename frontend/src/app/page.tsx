'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TypewriterIntro from '../components/TypewriterIntro';
import Hero from '../components/Hero';
import './home.css';

export default function Home() {
  const [showTypewriter, setShowTypewriter] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if typewriter has already been shown in this session
    const hasSeenTypewriter = sessionStorage.getItem('hasSeenTypewriter');
    
    if (!hasSeenTypewriter) {
      setShowTypewriter(true);
    }
    setIsLoading(false);
  }, []);

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
  if (isLoading) {
    return (
      <div className="home-page light-mode" style={{background: '#ffffff', minHeight: '100vh'}}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          {/* Optional: Add a subtle loading indicator */}
        </div>
      </div>
    );
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
