'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface ScatterPoint {
  difficulty: number; // 1-5 scale
  score: number; // 0-100
  question: string;
}

interface DifficultyScatterChartProps {
  data: ScatterPoint[];
}

export default function DifficultyScatterChart({ data }: DifficultyScatterChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    question: string;
    difficulty: string;
    score: number;
    x: number;
    y: number;
  } | null>(null);

  const difficultyLabels = ['', 'Easy', 'Medium', 'Hard', 'Very Hard', 'Expert'];
  
  // Filter valid data
  const validData = (data || []).filter(d => d && d.difficulty >= 1 && d.difficulty <= 5 && d.score >= 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // If no valid data, return early but keep canvas ready
    if (validData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Y-axis labels (Score)
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      const value = 100 - (i * 20);
      ctx.fillText(value.toString(), padding.left - 10, y + 4);
    }

    // X-axis labels (Difficulty)
    ctx.textAlign = 'center';
    for (let i = 1; i <= 5; i++) {
      const x = padding.left + (chartWidth / 5) * i;
      ctx.fillText(difficultyLabels[i], x - chartWidth / 10, height - padding.bottom + 20);
    }

    // Axis titles
    ctx.fillStyle = '#666';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Question Difficulty →', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Score (%) →', 0, 0);
    ctx.restore();

    // Draw trend line
    if (validData.length > 1) {
      const avgsByDifficulty: { [key: number]: number[] } = {};
      validData.forEach(point => {
        if (!avgsByDifficulty[point.difficulty]) {
          avgsByDifficulty[point.difficulty] = [];
        }
        avgsByDifficulty[point.difficulty].push(point.score);
      });

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();

      Object.keys(avgsByDifficulty).sort().forEach((diff, i) => {
        const difficulty = parseInt(diff);
        const avgScore = avgsByDifficulty[difficulty].reduce((a, b) => a + b, 0) / avgsByDifficulty[difficulty].length;
        const x = padding.left + ((difficulty - 1) / 4) * chartWidth;
        const y = padding.top + chartHeight - (avgScore / 100) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // Draw scatter points
    validData.forEach((point) => {
      const x = padding.left + ((point.difficulty - 1) / 4) * chartWidth;
      const y = padding.top + chartHeight - (point.score / 100) * chartHeight;

      // Color based on score
      let color;
      if (point.score >= 80) color = '#10b981';
      else if (point.score >= 60) color = '#f59e0b';
      else color = '#ef4444';

      // Draw point
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw outline
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }, [validData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || validData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    let closest: any = null;
    let minDist = Infinity;

    validData.forEach((point) => {
      const x = padding.left + ((point.difficulty - 1) / 4) * chartWidth;
      const y = padding.top + chartHeight - (point.score / 100) * chartHeight;

      const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
      if (dist < 15 && dist < minDist) {
        minDist = dist;
        closest = {
          question: point.question,
          difficulty: difficultyLabels[point.difficulty],
          score: point.score,
          x,
          y
        };
      }
    });

    setHoveredPoint(closest);
  };

  return (
    <div className="relative">
      {validData.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No performance data available</p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full h-[400px] rounded-lg"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
            style={{ background: 'linear-gradient(to bottom, #fafafa, #ffffff)' }}
          />
      
      {hoveredPoint && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-sm pointer-events-none z-10"
          style={{
            left: `${hoveredPoint.x}px`,
            top: `${hoveredPoint.y - 70}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-semibold">{hoveredPoint.question}</div>
          <div className="text-xs opacity-90">{hoveredPoint.difficulty}</div>
          <div className="text-xs opacity-90">Score: {hoveredPoint.score}%</div>
        </motion.div>
      )}
        </>
      )}
    </div>
  );
}
