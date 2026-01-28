'use client';

import { useEffect, useRef, useState } from 'react';

interface SkillDistributionChartProps {
  skills: {
    problem_solving: number;
    communication: number;
    code_quality: number;
    technical_depth: number;
    system_design: number;
    behavioral: number;
  };
}

export default function SkillDistributionChart({ skills }: SkillDistributionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current?.parentElement) {
        const parent = canvasRef.current.parentElement;
        const skillCount = Object.keys(skills).length;
        setDimensions({
          width: parent.clientWidth,
          height: Math.max(skillCount * 65, 350)
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [skills]);

  useEffect(() => {
    if (!canvasRef.current || dimensions.width === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const skillEntries = Object.entries(skills).sort((a, b) => b[1] - a[1]);
    const barHeight = 30;
    const barSpacing = 55;
    const padding = { left: 150, right: 60, top: 20, bottom: 20 };
    const maxBarWidth = dimensions.width - padding.left - padding.right;

    const formatSkillName = (skill: string) => {
      return skill
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const getBarColor = (value: number): { start: string; end: string } => {
      if (value >= 80) return { start: '#10b981', end: '#059669' }; // green
      if (value >= 60) return { start: '#f59e0b', end: '#f97316' }; // yellow-orange
      return { start: '#ef4444', end: '#ec4899' }; // red-pink
    };

    skillEntries.forEach(([skill, value], index) => {
      const y = padding.top + index * barSpacing;
      const barWidth = (value / 100) * maxBarWidth;
      const isHovered = hoveredSkill === skill;

      // Draw skill name
      ctx.font = isHovered ? 'bold 14px Inter, sans-serif' : '500 13px Inter, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatSkillName(skill), padding.left - 15, y + barHeight / 2);

      // Draw background bar
      ctx.fillStyle = '#f3f4f6';
      ctx.beginPath();
      ctx.roundRect(padding.left, y, maxBarWidth, barHeight, 16);
      ctx.fill();

      // Draw filled bar with gradient
      const colors = getBarColor(value);
      const gradient = ctx.createLinearGradient(padding.left, 0, padding.left + barWidth, 0);
      gradient.addColorStop(0, colors.start);
      gradient.addColorStop(1, colors.end);

      ctx.fillStyle = gradient;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = isHovered ? 12 : 8;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.roundRect(
        padding.left,
        y,
        barWidth,
        barHeight,
        16
      );
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw percentage value
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      
      if (value > 15) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${value}%`, padding.left + barWidth - 12, y + barHeight / 2);
      } else {
        ctx.fillStyle = '#1f2937';
        ctx.fillText(`${value}%`, padding.left + maxBarWidth + 10, y + barHeight / 2);
      }

      // Draw hover badge
      if (isHovered) {
        const badge = value >= 80 ? 'Expert' : value >= 60 ? 'Proficient' : 'Developing';
        ctx.font = '600 11px Inter, sans-serif';
        const badgeWidth = ctx.measureText(badge).width + 16;
        const badgeX = padding.left + (maxBarWidth - badgeWidth) / 2;
        const badgeY = y + barHeight / 2 - 10;

        // Badge background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, 20, 4);
        ctx.fill();

        // Badge text
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badge, badgeX + badgeWidth / 2, badgeY + 10);
      }
    });
  }, [skills, dimensions, hoveredSkill]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const barSpacing = 40;
    const padding = { top: 20 };
    const barHeight = 32;
    
    const skillEntries = Object.entries(skills).sort((a, b) => b[1] - a[1]);
    const hoveredIndex = skillEntries.findIndex((_, index) => {
      const barY = padding.top + index * barSpacing;
      return y >= barY && y <= barY + barHeight;
    });

    if (hoveredIndex >= 0) {
      setHoveredSkill(skillEntries[hoveredIndex][0]);
      canvasRef.current.style.cursor = 'pointer';
    } else {
      setHoveredSkill(null);
      canvasRef.current.style.cursor = 'default';
    }
  };

  const handleMouseLeave = () => {
    setHoveredSkill(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: '100%', height: 'auto' }}
    />
  );
}
