'use client';

import { useState, useEffect } from 'react';
import './Hero.css';
import Navbar from './Navbar';
import Features from './Features';

interface HeroProps {
  onTakeInterview: () => void;
  onViewResults?: () => void;
  onGoHome?: () => void;
}

const Hero = ({ onTakeInterview, onViewResults, onGoHome }: HeroProps) => {
  const phrase = 'Interviews Reimagined...';
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    const typingSpeed = 100; // ms per character
    const pauseAtEnd = 1500; // ms pause at end before restarting
    
    // Typing animation
    if (displayText.length < phrase.length) {
      const timer = setTimeout(() => {
        setDisplayText(phrase.substring(0, displayText.length + 1));
      }, typingSpeed);
      return () => clearTimeout(timer);
    }
    
    // Completed typing, pause then restart
    if (displayText.length === phrase.length) {
      const timer = setTimeout(() => {
        setDisplayText('');
      }, pauseAtEnd);
      return () => clearTimeout(timer);
    }
  }, [displayText, phrase]);

  return (
    <>
      <Navbar />
      <section className="hero section" id="home">
        <div className="container">
          <div className="hero-content flex flex-col lg:flex-row items-center gap-8 lg:gap-16">
            <div className="hero-left slide-up w-full lg:w-1/2">
              <h1 className="hero-title text-3xl sm:text-4xl lg:text-5xl xl:text-6xl">
                <span className="typewriter-text">
                  {displayText}
                  <span className="typewriter-cursor">|</span>
                </span>
              </h1>
              <p className="hero-subtitle text-base sm:text-lg lg:text-xl">
                Experience the future of interview practice with AI-powered mock interviews, 
                intelligent feedback, and personalized learning paths.
              </p>
              <div className="hero-buttons flex flex-col sm:flex-row gap-4 mt-6 sm:mt-8">
                <button onClick={onTakeInterview} className="btn btn-primary glow-on-hover w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base min-h-[48px]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <polygon points="5,3 19,12 5,21 5,3"></polygon>
                  </svg>
                  Start Interview
                </button>
              </div>
            </div>
            
            <div className="hero-right slide-up w-full lg:w-1/2 mt-8 lg:mt-0">
              <div className="hero-illustration relative">
                <div className="floating-card card-1">
                  <div className="card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4"></path>
                      <circle cx="12" cy="12" r="9"></circle>
                    </svg>
                  </div>
                  <span>AI Analysis</span>
                </div>
                
                <div className="floating-card card-2">
                  <div className="card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </div>
                  <span>Smart Feedback</span>
                </div>
                
                <div className="floating-card card-3">
                  <div className="card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
                    </svg>
                  </div>
                  <span>Performance Tracking</span>
                </div>
                
                <div className="hero-main-visual">
                  <div className="brain-container">
                    <div className="brain-outline"></div>
                    <div className="neural-network">
                      <div className="neural-node node-1"></div>
                      <div className="neural-node node-2"></div>
                      <div className="neural-node node-3"></div>
                      <div className="neural-node node-4"></div>
                      <div className="neural-connection conn-1"></div>
                      <div className="neural-connection conn-2"></div>
                      <div className="neural-connection conn-3"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Features />
    </>
  );
};

export default Hero;