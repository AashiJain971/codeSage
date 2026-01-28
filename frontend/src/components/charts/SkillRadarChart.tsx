'use client';

import { motion } from 'framer-motion';
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
  const [hoveredSkill, setHoveredSkill] = useState<{ skill: string; value: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mouse interaction handler
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const maxRadius = canvas.width / 2 - 40;
      
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
          canvas.style.cursor = 'pointer';
          setHoveredSkill({ skill: skill.replace('_', ' '), value });
          found = true;
        }
      });
      
      if (!found) {
        canvas.style.cursor = 'default';
        setHoveredSkill(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [skills]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2 - 40;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw grid
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;

    for (let i = 1; i <= 5; i++) {
      const radius = (maxRadius / 5) * i;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Skill labels and data
    const skillEntries = Object.entries(skills);
    const angleStep = (2 * Math.PI) / skillEntries.length;

    // Draw axes
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    skillEntries.forEach((_, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const x = centerX + Math.cos(angle) * maxRadius;
      const y = centerY + Math.sin(angle) * maxRadius;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // Draw data polygon
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;

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

    // Draw data points
    ctx.fillStyle = '#3b82f6';
    skillEntries.forEach(([_, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const radius = (value / 100) * maxRadius;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    skillEntries.forEach(([skill, value], index) => {
      const angle = index * angleStep - Math.PI / 2;
      const labelRadius = maxRadius + 30;
      const x = centerX + Math.cos(angle) * labelRadius;
      const y = centerY + Math.sin(angle) * labelRadius;
      
      const label = skill.replace('_', ' ').split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      
      // Split long labels into multiple lines
      if (label.length > 12) {
        const words = label.split(' ');
        ctx.fillText(words[0], x, y - 6);
        if (words[1]) ctx.fillText(words[1], x, y + 6);
      } else {
        ctx.fillText(label, x, y);
      }
    });
  }, [skills]);

  return (
    <div className="relative flex flex-col items-center">
      <canvas 
        ref={canvasRef} 
        className="max-w-full rounded-lg" 
        style={{ background: 'linear-gradient(to bottom, #fafafa, #ffffff)' }}
      />
      {hoveredSkill && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg z-10"
        >
          <div className="font-semibold capitalize">{hoveredSkill.skill}</div>
          <div className="text-xs text-gray-300">{hoveredSkill.value}%</div>
        </motion.div>
      )}
    </div>
  );
}
