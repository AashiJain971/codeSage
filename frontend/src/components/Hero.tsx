'use client';

import './Hero.css';
import Navbar from './Navbar';
import Features from './Features';

interface HeroProps {
  onTakeInterview: () => void;
  onViewResults?: () => void;
  onGoHome?: () => void;
}

const Hero = ({ onTakeInterview, onViewResults, onGoHome }: HeroProps) => {
  return (
    <>
      <Navbar />
      <section className="hero section" id="home">
        <div className="container">
          <div className="hero-content">
            <div className="hero-left slide-up">
              <h1 className="hero-title">
                Redefining Interview Preparation
              </h1>
              <p className="hero-subtitle">
                Experience the future of interview practice with AI-powered mock interviews, 
                intelligent feedback, and personalized learning paths.
              </p>
              <div className="hero-buttons">
                <button onClick={onTakeInterview} className="btn btn-primary glow-on-hover">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5,3 19,12 5,21 5,3"></polygon>
                  </svg>
                  Start Interview
                </button>
              </div>
            </div>
            
            <div className="hero-right slide-up">
              <div className="hero-illustration">
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