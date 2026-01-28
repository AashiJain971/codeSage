'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface FunnelData {
  asked: number;
  attempted: number;
  solved: number;
  solvedWithoutHints: number;
}

interface QuestionFunnelChartProps {
  data: FunnelData;
}

export default function QuestionFunnelChart({ data }: QuestionFunnelChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStage, setHoveredStage] = useState<{
    label: string;
    count: number;
    percentage: number;
    y: number;
  } | null>(null);

  // Validate data
  const validData = {
    asked: Math.max(data?.asked || 0, 1),
    attempted: Math.max(data?.attempted || 0, 0),
    solved: Math.max(data?.solved || 0, 0),
    solvedWithoutHints: Math.max(data?.solvedWithoutHints || 0, 0)
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || validData.asked === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 60, bottom: 40, left: 60 };
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const stages = [
      { label: 'Asked', count: validData.asked, color: '#3b82f6' },
      { label: 'Attempted', count: validData.attempted, color: '#8b5cf6' },
      { label: 'Solved', count: validData.solved, color: '#10b981' },
      { label: 'Solved Without Hints', count: validData.solvedWithoutHints, color: '#059669' }
    ];

    const maxWidth = width - padding.left - padding.right;
    const stageHeight = chartHeight / stages.length;

    stages.forEach((stage, i) => {
      const percentage = validData.asked > 0 ? (stage.count / validData.asked) * 100 : 0;
      const stageWidth = (percentage / 100) * maxWidth;
      const y = padding.top + i * stageHeight;
      const x = padding.left + (maxWidth - stageWidth) / 2;

      // Draw trapezoid/rectangle
      const nextPercentage = i < stages.length - 1 
        ? (stages[i + 1].count / validData.asked) * 100 
        : percentage;
      const nextWidth = (nextPercentage / 100) * maxWidth;

      const gradient = ctx.createLinearGradient(x, y, x + stageWidth, y + stageHeight);
      gradient.addColorStop(0, stage.color);
      gradient.addColorStop(1, stage.color + 'cc');

      ctx.fillStyle = gradient;
      
      if (i < stages.length - 1) {
        // Trapezoid
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + stageWidth, y);
        ctx.lineTo(padding.left + (maxWidth - nextWidth) / 2 + nextWidth, y + stageHeight);
        ctx.lineTo(padding.left + (maxWidth - nextWidth) / 2, y + stageHeight);
        ctx.closePath();
        ctx.fill();
      } else {
        // Rectangle for last stage
        ctx.fillRect(x, y, stageWidth, stageHeight - 10);
      }

      // Draw border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw label and count
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(stage.label, width / 2, y + stageHeight / 2 - 5);

      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`${stage.count} (${percentage.toFixed(1)}%)`, width / 2, y + stageHeight / 2 + 15);

      // Draw conversion rate between stages
      if (i > 0) {
        const prevCount = stages[i - 1].count;
        const conversionRate = prevCount > 0 ? (stage.count / prevCount) * 100 : 0;
        ctx.fillStyle = '#666';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`↓ ${conversionRate.toFixed(1)}%`, width / 2, y - 5);
      }
    });

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Question Completion Funnel', width / 2, 25);
  }, [validData]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || validData.asked === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    const padding = { top: 40, right: 60, bottom: 40, left: 60 };
    const chartHeight = rect.height - padding.top - padding.bottom;

    const stages = [
      { label: 'Asked', count: validData.asked },
      { label: 'Attempted', count: validData.attempted },
      { label: 'Solved', count: validData.solved },
      { label: 'Solved Without Hints', count: validData.solvedWithoutHints }
    ];

    const stageHeight = chartHeight / stages.length;

    let hovered: any = null;

    stages.forEach((stage, i) => {
      const y = padding.top + i * stageHeight;
      if (mouseY >= y && mouseY <= y + stageHeight) {
        const percentage = validData.asked > 0 ? (stage.count / validData.asked) * 100 : 0;
        hovered = {
          label: stage.label,
          count: stage.count,
          percentage,
          y: y + stageHeight / 2
        };
      }
    });

    setHoveredStage(hovered);
  };

  return (
    <div className="relative">
      {validData.asked === 0 ? (
        <div className="flex items-center justify-center h-[500px] bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-sm">No completion data available</p>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={600}
            height={500}
            className="w-full h-[500px] rounded-lg"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredStage(null)}
            style={{ background: 'linear-gradient(to bottom, #fafafa, #ffffff)' }}
          />
      
          {hoveredStage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl text-sm pointer-events-none z-10 right-10"
              style={{
                top: `${hoveredStage.y}px`,
                transform: 'translateY(-50%)'
              }}
            >
              <div className="font-semibold">{hoveredStage.label}</div>
              <div className="text-xs opacity-90">Count: {hoveredStage.count}</div>
              <div className="text-xs opacity-90">{hoveredStage.percentage.toFixed(1)}% of total</div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
