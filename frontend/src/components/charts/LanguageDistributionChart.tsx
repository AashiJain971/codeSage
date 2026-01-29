'use client';

import { useEffect, useRef } from 'react';

interface LanguageDistributionChartProps {
  interviews: Array<{
    id: string;
    type: string;
    questions_data?: Array<{ 
      language?: string;
      question_index?: number;
    }>;
  }>;
}

export default function LanguageDistributionChart({ interviews }: LanguageDistributionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !interviews) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Extract languages from technical interviews
    const languageCount: { [key: string]: number } = {};
    
    interviews.forEach(interview => {
      if (interview.type === 'technical' && interview.questions_data) {
        interview.questions_data.forEach(question => {
          const lang = question.language || 'python';
          languageCount[lang] = (languageCount[lang] || 0) + 1;
        });
      }
    });

    // If no data, show default message
    if (Object.keys(languageCount).length === 0) {
      // Set canvas size
      canvas.width = 400;
      canvas.height = 260;
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No coding data available yet', 200, 120);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.fillText('Complete technical interviews to see language stats', 200, 145);
      return;
    }

    // Sort languages by usage
    const sortedLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6); // Top 6 languages

    const total = sortedLanguages.reduce((sum, [, count]) => sum + count, 0);

    // Set canvas size with more padding
    canvas.width = 500;
    canvas.height = 280;

    // Clear with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Colors for different languages (modern gradient-friendly colors)
    const colors = [
      { main: '#6366f1', light: '#818cf8' }, // indigo
      { main: '#8b5cf6', light: '#a78bfa' }, // purple
      { main: '#ec4899', light: '#f472b6' }, // pink
      { main: '#f59e0b', light: '#fbbf24' }, // amber
      { main: '#10b981', light: '#34d399' }, // emerald
      { main: '#06b6d4', light: '#22d3ee' }, // cyan
    ];

    // Chart dimensions
    const barWidth = 60;
    const maxHeight = 160;
    const spacing = 25;
    const startX = (canvas.width - (sortedLanguages.length * (barWidth + spacing))) / 2;
    const baseY = 220;
    const topPadding = 40;

    // Find max count for scaling
    const maxCount = Math.max(...sortedLanguages.map(([, count]) => count));

    // Draw subtle grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = topPadding + (maxHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(canvas.width - 30, y);
      ctx.stroke();
    }

    sortedLanguages.forEach(([language, count], index) => {
      const barHeight = (count / maxCount) * maxHeight;
      const x = startX + index * (barWidth + spacing);
      const y = baseY - barHeight;

      // Draw bar with modern gradient and shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      const gradient = ctx.createLinearGradient(x, y, x, baseY);
      gradient.addColorStop(0, colors[index].light);
      gradient.addColorStop(1, colors[index].main);
      
      ctx.fillStyle = gradient;
      
      // Rounded corners
      const radius = 6;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.arcTo(x + barWidth, y, x + barWidth, y + radius, radius);
      ctx.lineTo(x + barWidth, baseY);
      ctx.lineTo(x, baseY);
      ctx.lineTo(x, y + radius);
      ctx.arcTo(x, y, x + radius, y, radius);
      ctx.closePath();
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw count badge on top of bar
      const badgeY = y - 20;
      ctx.fillStyle = colors[index].main;
      ctx.beginPath();
      ctx.roundRect(x + barWidth / 2 - 18, badgeY - 10, 36, 20, 10);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count.toString(), x + barWidth / 2, badgeY + 4);

      // Draw language name
      ctx.fillStyle = '#1f2937';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.fillText(
        language.charAt(0).toUpperCase() + language.slice(1),
        x + barWidth / 2,
        baseY + 22
      );

      // Draw percentage
      const percentage = ((count / total) * 100).toFixed(0);
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${percentage}%`, x + barWidth / 2, baseY + 38);
    });

  }, [interviews]);

  return (
    <div className="flex items-center justify-center p-2">
      <canvas 
        ref={canvasRef}
        className="max-w-full"
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  );
}
