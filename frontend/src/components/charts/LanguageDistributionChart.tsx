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
      canvas.height = 300;
      
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No coding data available yet', 200, 150);
      ctx.fillText('Complete technical interviews to see language stats', 200, 175);
      return;
    }

    // Sort languages by usage
    const sortedLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6); // Top 6 languages

    const total = sortedLanguages.reduce((sum, [, count]) => sum + count, 0);

    // Set canvas size
    canvas.width = 400;
    canvas.height = 300;

    // Colors for different languages
    const colors = [
      '#6366f1', // indigo
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#f59e0b', // amber
      '#10b981', // emerald
      '#06b6d4', // cyan
    ];

    // Draw bar chart
    const barWidth = 50;
    const maxHeight = 180;
    const spacing = 20;
    const startX = (canvas.width - (sortedLanguages.length * (barWidth + spacing))) / 2;
    const baseY = 240;

    // Find max count for scaling
    const maxCount = Math.max(...sortedLanguages.map(([, count]) => count));

    sortedLanguages.forEach(([language, count], index) => {
      const barHeight = (count / maxCount) * maxHeight;
      const x = startX + index * (barWidth + spacing);
      const y = baseY - barHeight;

      // Draw bar
      const gradient = ctx.createLinearGradient(x, y, x, baseY);
      gradient.addColorStop(0, colors[index]);
      gradient.addColorStop(1, colors[index] + '99');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw count on top of bar
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(count.toString(), x + barWidth / 2, y - 8);

      // Draw language name
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(
        language.charAt(0).toUpperCase() + language.slice(1),
        x + barWidth / 2,
        baseY + 20
      );

      // Draw percentage
      const percentage = ((count / total) * 100).toFixed(0);
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${percentage}%`, x + barWidth / 2, baseY + 35);
    });

    // Draw title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Languages Used', canvas.width / 2, 25);

  }, [interviews]);

  return (
    <div className="flex items-center justify-center">
      <canvas 
        ref={canvasRef}
        className="max-w-full"
        style={{ width: '100%', height: 'auto' }}
      />
    </div>
  );
}
