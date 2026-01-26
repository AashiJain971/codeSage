'use client';

import './Features.css';

const Features = () => {
  const features = [
    {
      id: 1,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4"></path>
          <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
          <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
          <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"></path>
          <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"></path>
        </svg>
      ),
      title: 'Technical Interviews',
      description: 'AI-led technical interviews designed to evaluate problem-solving, reasoning, and explanation depth. Includes real-time voice interaction, coding environment, and structured evaluation.'
    },
    {
      id: 2,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10,9 9,9 8,9"></polyline>
        </svg>
      ),
      title: 'Resume-Based Interviews',
      description: 'Upload your resume and get personalized interview questions based on your experience, projects, and skills. Designed to assess real-world experience, decision-making, and role readiness.'
    },
    {
      id: 3,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      ),
      title: 'Past Interview Analytics',
      description: 'Review all your past interviews with detailed performance metrics, and visual analytics. View structured interview summaries, skill-wise evaluations, and AI recommendations generated from past interviews.'
    },
    {
      id: 4,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12,6 12,12 16,14"></polyline>
        </svg>
      ),
      title: 'Real-Time Voice Interaction',
      description: 'Experience natural interview conversations with speech-to-text transcription, AI-powered responses, and seamless voice interaction for natural, explanation-driven interview conversations.'
    }
  ];

  return (
    <section className="features section" id="features">
      <div className="container px-4 sm:px-6 lg:px-8">
        <h2 className="section-title slide-up text-2xl sm:text-3xl lg:text-4xl">
          Why Choose CodeSage?
        </h2>
        
        <div className="features-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mt-8 lg:mt-12">
          {features.map((feature, index) => (
            <div 
              key={feature.id} 
              className="feature-card slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="feature-icon">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
              <div className="feature-glow"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;