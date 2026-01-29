'use client';

import { useEffect, useRef, useState } from 'react';

interface SkillRadarChartProps {
  skills: {
    problem_solving: number;
    communication: number;
    code_quality: number;
    technical_depth: number;
    system_design: number;
    behavioral: number;
  };
}

export default function SkillRadarChart({ skills }: SkillRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with more space for labels
    canvas.width = 500;
    canvas.height = 460;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + 20;
    const maxRadius = 150;

    // Draw grid levels with subtle styling
    for (let i = 1; i <= 5; i++) {
      const radius = (maxRadius / 5) * i;
      ctx.strokeStyle = i === 5 ? '#d1d5db' : '#f3f4f6';
      ctx.lineWidth = i === 5 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Skill labels and data
    const skillEntries = Object.entries(skills);
    const angleStep = (2 * Math.PI) / skillEntries.length;

    // Draw axes with modern style
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1.5;
    skillEntries.forEach((_, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // Draw data polygon with modern gradient and shadow
    ctx.shadowColor = 'rgba(99, 102, 241, 0.3)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 5;
    
    ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    skillEntries.forEach(([_, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Draw data points with modern design
    skillEntries.forEach(([_, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Outer circle (white border)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner circle (colored)
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels with modern styling
    skillEntries.forEach(([skill, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const labelRadius = maxRadius + 40;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      const label = skill.replace('_', ' ').split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const isHovered = hoveredSkill === skill;
      
      // Draw label
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isHovered) {
        ctx.font = '600 13px Inter, sans-serif';
        ctx.fillStyle = '#6366f1';
      } else {
        ctx.font = '600 12px Inter, sans-serif';
        ctx.fillStyle = '#1f2937';
      }
      
      // Handle long labels
      if (label.length > 12) {
        const words = label.split(' ');
        ctx.fillText(words[0], x, y - 6);
        if (words[1]) ctx.fillText(words[1], x, y + 6);
      } else {
        ctx.fillText(label, x, y);
      }
      
      // Draw value badge below label
      const badgeY = label.length > 12 ? y + 18 : y + 12;
      if (isHovered) {
        // Highlighted badge
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(x - 20, badgeY, 40, 18, 9);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(`${value.toFixed(0)}`, x, badgeY + 10);
      } else {
        // Normal badge
        ctx.fillStyle = '#f3f4f6';
        ctx.beginPath();
        ctx.roundRect(x - 20, badgeY, 40, 18, 9);
        ctx.fill();
        
        ctx.fillStyle = '#6b7280';
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillText(`${value.toFixed(0)}`, x, badgeY + 10);
      }
    });
  }, [skills, hoveredSkill]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 + 20;
    const maxRadius = 150;
    
    const skillEntries = Object.entries(skills);
    const angleStep = (2 * Math.PI) / skillEntries.length;
    
    let found = false;
    skillEntries.forEach(([skill, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      const px = centerX + Math.cos(angle) * radius;
      const py = centerY + Math.sin(angle) * radius;
      
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      if (dist < 15) {
        setHoveredSkill(skill);
        found = true;
      }
    });
    
    if (!found) {
      setHoveredSkill(null);
    }
  };

  return (
    <div className="flex items-center justify-center p-2">
      <canvas 
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredSkill(null)}
        className="max-w-full cursor-pointer"
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  );
}
