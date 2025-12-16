'use client';

import { useState, useEffect } from 'react';
import './TypewriterIntro.css';

interface TypewriterIntroProps {
  onComplete: () => void;
}

const TypewriterIntro = ({ onComplete }: TypewriterIntroProps) => {
  const [displayText, setDisplayText] = useState('');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const phases = [
    'Welcome to CodeSage',
    'Interviews Reimagined...'
  ];

  useEffect(() => {
    if (currentPhase >= phases.length) {
      // Much shorter delay before transitioning to dashboard
      setTimeout(onComplete, 500);
      return;
    }

    const currentText = phases[currentPhase];
    
    if (currentIndex < currentText.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + currentText[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 60); // Faster typing (was 100ms)
      
      return () => clearTimeout(timer);
    } else {
      // Shorter wait before starting next phase
      const timer = setTimeout(() => {
        setDisplayText('');
        setCurrentIndex(0);
        setCurrentPhase(prev => prev + 1);
      }, 800); // Much shorter wait (was 2000ms)
      
      return () => clearTimeout(timer);
    }
  }, [currentIndex, currentPhase, phases, onComplete]);

  return (
    <div className="typewriter-intro">
      <div className="typewriter-content">
        <div className="typewriter-text">
          {displayText}
          <span className="cursor">|</span>
        </div>
        {currentPhase < phases.length && (
          <div style={{
            marginTop: '2rem',
            fontSize: '1rem',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            Loading your interview experience...
          </div>
        )}
      </div>
    </div>
  );
};

export default TypewriterIntro;