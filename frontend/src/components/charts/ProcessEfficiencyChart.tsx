'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface EfficiencyData {
  question: string;
  timeTaken: number; // in seconds
  hintsUsed: number;
  retries: number;
  completed: boolean;
}

interface ProcessEfficiencyChartProps {
  data: EfficiencyData[];
}

export default function ProcessEfficiencyChart({ data }: ProcessEfficiencyChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredBar, setHoveredBar] = useState<{
    question: string;
    timeTaken: number;
    hintsUsed: number;
    retries: number;
    completed: boolean;
    x: number;
    y: number;
  } | null>(null);

  // Filter and validate data
  const validData = (data || []).filter(d => d && typeof d.timeTaken === 'number' && d.timeTaken >= 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // If no valid data, we'll return early but still set up canvas
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
    const padding = { top: 40, right: 140, bottom: 80, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
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

    // Find max time for scaling
    const maxTime = Math.max(...validData.map(d => d.timeTaken), 60);
    const maxValue = Math.ceil(maxTime / 60) * 60; // Round up to nearest minute

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      const value = Math.round((maxValue / 5) * (5 - i) / 60); // Convert to minutes
      ctx.fillText(`${value}m`, padding.left - 10, y + 4);
    }

    // Axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Questions →', width / 2, height - 10);

    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Time Taken (minutes) →', 0, 0);
    ctx.restore();

    const barWidth = chartWidth / validData.length * 0.7;
    const spacing = chartWidth / validData.length;

    // Draw stacked bars
    validData.forEach((item, i) => {
      const x = padding.left + spacing * i + (spacing - barWidth) / 2;
      const totalHeight = (item.timeTaken / maxValue) * chartHeight;
      
      // Base time (green for completed, red for incomplete)
      const baseColor = item.completed ? '#10b981' : '#ef4444';
      ctx.fillStyle = baseColor;
      ctx.fillRect(x, height - padding.bottom - totalHeight, barWidth, totalHeight);

      // Hints overlay (orange)
      if (item.hintsUsed > 0) {
        const hintHeight = Math.min(totalHeight * 0.3, (item.hintsUsed / 3) * 30);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
        ctx.fillRect(x, height - padding.bottom - totalHeight, barWidth, hintHeight);
      }

      // Retries indicator (dots)
      if (item.retries > 0) {
        ctx.fillStyle = '#8b5cf6';
        for (let r = 0; r < Math.min(item.retries, 3); r++) {
          ctx.beginPath();
          ctx.arc(x + barWidth / 2, height - padding.bottom - totalHeight - 10 - r * 8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Question label
      ctx.fillStyle = '#666';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x + barWidth / 2, height - padding.bottom + 15);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(`Q${i + 1}`, 0, 0);
      ctx.restore();
    });

    // Draw legend
    ctx.font = '11px Inter, sans-serif';
    const legends = [
      { color: '#10b981', label: 'Completed' },
      { color: '#ef4444', label: 'Incomplete' },
      { color: '#f59e0b', label: 'Hints Used' },
      { color: '#8b5cf6', label: 'Retries' }
    ];

    legends.forEach((legend, i) => {
      const legendX = width - padding.right + 10;
      const legendY = padding.top + i * 22;

      ctx.fillStyle = legend.color;
      ctx.fillRect(legendX, legendY - 6, 12, 12);

      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(legend.label, legendX + 18, legendY + 4);
    });
  }, [validData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || validData.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 40, right: 140, bottom: 80, left: 60 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    const barWidth = chartWidth / validData.length * 0.7;
    const spacing = chartWidth / validData.length;

    let hovered: any = null;

    validData.forEach((item, i) => {
      const barX = padding.left + spacing * i + (spacing - barWidth) / 2;
      const maxTime = Math.max(...validData.map(d => d.timeTaken), 60);
      const maxValue = Math.ceil(maxTime / 60) * 60;
      const totalHeight = (item.timeTaken / maxValue) * chartHeight;
      const barY = rect.height - padding.bottom - totalHeight;

      if (x >= barX && x <= barX + barWidth && y >= barY && y <= rect.height - padding.bottom) {
        hovered = {
          question: `Question ${i + 1}`,
          timeTaken: item.timeTaken,
          hintsUsed: item.hintsUsed,
          retries: item.retries,
          completed: item.completed,
          x: barX + barWidth / 2,
          y: barY
        };
      }
    });

    setHoveredBar(hovered);
  };

  return (
    <div className="relative">
      {validData.length === 0 ? (
        <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No efficiency data available</p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={700}
            height={400}
            className="w-full h-[400px] rounded-lg"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredBar(null)}
            style={{ background: 'linear-gradient(to bottom, #fafafa, #ffffff)' }}
          />
      
      {hoveredBar && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs pointer-events-none z-10"
          style={{
            left: `${hoveredBar.x}px`,
            top: `${hoveredBar.y - 100}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-semibold mb-1">{hoveredBar.question}</div>
          <div className="space-y-0.5">
            <div>Time: {Math.floor(hoveredBar.timeTaken / 60)}m {Math.floor(hoveredBar.timeTaken % 60)}s</div>
            <div>Hints: {hoveredBar.hintsUsed}</div>
            <div>Retries: {hoveredBar.retries}</div>
            <div className={hoveredBar.completed ? 'text-green-400' : 'text-red-400'}>
              {hoveredBar.completed ? '✓ Completed' : '✗ Incomplete'}
            </div>
          </div>
        </motion.div>
      )}
        </>
      )}
    </div>
  );
}
