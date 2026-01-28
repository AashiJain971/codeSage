'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface TopicPerformance {
  topic: string;
  interviews: { date: string; score: number }[];
}

interface TopicHeatmapProps {
  data: TopicPerformance[];
}

export default function TopicHeatmap({ data }: TopicHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    topic: string;
    interview: number;
    score: number;
    date: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 100, bottom: 40, left: 120 };

    const maxInterviews = Math.max(...data.map(d => d.interviews.length));
    const cellWidth = (width - padding.left - padding.right) / maxInterviews;
    const cellHeight = (height - padding.top - padding.bottom) / data.length;

    ctx.clearRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Interview Performance by Topic', width / 2, 20);

    // Draw topic labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    data.forEach((topicData, i) => {
      const y = padding.top + i * cellHeight + cellHeight / 2;
      ctx.fillText(topicData.topic, padding.left - 10, y + 4);
    });

    // Draw interview numbers
    ctx.textAlign = 'center';
    for (let i = 0; i < maxInterviews; i++) {
      const x = padding.left + i * cellWidth + cellWidth / 2;
      ctx.fillText(`#${i + 1}`, x, padding.top - 10);
    }

    // Draw heatmap cells
    data.forEach((topicData, topicIdx) => {
      topicData.interviews.forEach((interview, interviewIdx) => {
        const x = padding.left + interviewIdx * cellWidth;
        const y = padding.top + topicIdx * cellHeight;

        // Color based on score
        const score = interview.score;
        let color;
        if (score >= 90) color = '#10b981'; // Green
        else if (score >= 80) color = '#34d399';
        else if (score >= 70) color = '#fbbf24'; // Yellow
        else if (score >= 60) color = '#fb923c'; // Orange
        else if (score >= 50) color = '#f87171'; // Light red
        else color = '#ef4444'; // Red

        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

        // Add score text for larger cells
        if (cellWidth > 40 && cellHeight > 30) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(score.toString(), x + cellWidth / 2, y + cellHeight / 2 + 4);
        }
      });
    });

    // Draw grid lines
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 0; i <= data.length; i++) {
      const y = padding.top + i * cellHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + maxInterviews * cellWidth, y);
      ctx.stroke();
    }
    for (let i = 0; i <= maxInterviews; i++) {
      const x = padding.left + i * cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + data.length * cellHeight);
      ctx.stroke();
    }

    // Draw color legend
    const legendX = width - padding.right + 20;
    const legendY = padding.top;
    const legendHeight = 150;
    const legendWidth = 20;

    const gradient = ctx.createLinearGradient(0, legendY, 0, legendY + legendHeight);
    gradient.addColorStop(0, '#10b981');
    gradient.addColorStop(0.25, '#fbbf24');
    gradient.addColorStop(0.5, '#fb923c');
    gradient.addColorStop(1, '#ef4444');

    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

    // Legend labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('100', legendX + legendWidth + 5, legendY + 4);
    ctx.fillText('75', legendX + legendWidth + 5, legendY + legendHeight / 2 + 4);
    ctx.fillText('50', legendX + legendWidth + 5, legendY + legendHeight + 4);
  }, [data]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 40, right: 100, bottom: 40, left: 120 };
    const maxInterviews = Math.max(...data.map(d => d.interviews.length));
    const cellWidth = (rect.width - padding.left - padding.right) / maxInterviews;
    const cellHeight = (rect.height - padding.top - padding.bottom) / data.length;

    let hovered: any = null;

    data.forEach((topicData, topicIdx) => {
      topicData.interviews.forEach((interview, interviewIdx) => {
        const x = padding.left + interviewIdx * cellWidth;
        const y = padding.top + topicIdx * cellHeight;

        if (mouseX >= x && mouseX <= x + cellWidth &&
            mouseY >= y && mouseY <= y + cellHeight) {
          hovered = {
            topic: topicData.topic,
            interview: interviewIdx + 1,
            score: interview.score,
            date: new Date(interview.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            x: x + cellWidth / 2,
            y: y
          };
        }
      });
    });

    setHoveredCell(hovered);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={700}
        height={400}
        className="w-full h-[400px] rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCell(null)}
        style={{ background: 'linear-gradient(to bottom, #fafafa, #ffffff)' }}
      />
      
      {hoveredCell && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm pointer-events-none z-10"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 80}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-semibold">{hoveredCell.topic}</div>
          <div className="text-xs opacity-90">Interview #{hoveredCell.interview}</div>
          <div className="text-xs opacity-90">Score: {hoveredCell.score}%</div>
          <div className="text-xs opacity-75">{hoveredCell.date}</div>
        </motion.div>
      )}
    </div>
  );
}
