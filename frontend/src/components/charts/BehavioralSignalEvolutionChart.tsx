'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface BehavioralData {
  date: string;
  confidence: number;
  ownership: number;
  hesitation: number;
  recovery: number;
  clarity: number;
}

interface BehavioralSignalEvolutionChartProps {
  data: BehavioralData[];
}

export default function BehavioralSignalEvolutionChart({ data }: BehavioralSignalEvolutionChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    signal: string;
    value: number;
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
    const padding = { top: 30, right: 120, bottom: 50, left: 50 };
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

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      const value = 100 - (i * 20);
      ctx.fillText(value.toString(), padding.left - 10, y + 4);
    }

    // X-axis label
    ctx.textAlign = 'center';
    ctx.fillStyle = '#666';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Interview Timeline →', width / 2, height - 10);

    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Signal Strength (%) →', 0, 0);
    ctx.restore();

    const signals = [
      { key: 'confidence', color: '#3b82f6', label: 'Confidence' },
      { key: 'ownership', color: '#10b981', label: 'Ownership' },
      { key: 'hesitation', color: '#ef4444', label: 'Hesitation' },
      { key: 'recovery', color: '#f59e0b', label: 'Recovery' },
      { key: 'clarity', color: '#8b5cf6', label: 'Clarity' }
    ];

    // Draw lines for each signal
    signals.forEach((signal) => {
      ctx.strokeStyle = signal.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      data.forEach((point, i) => {
        const x = padding.left + (chartWidth / (data.length - 1)) * i;
        const value = point[signal.key as keyof BehavioralData] as number;
        const y = padding.top + chartHeight - (value / 100) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw points
      data.forEach((point, i) => {
        const x = padding.left + (chartWidth / (data.length - 1)) * i;
        const value = point[signal.key as keyof BehavioralData] as number;
        const y = padding.top + chartHeight - (value / 100) * chartHeight;

        ctx.fillStyle = signal.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Draw legend
    ctx.font = '12px Inter, sans-serif';
    signals.forEach((signal, i) => {
      const legendX = width - padding.right + 10;
      const legendY = padding.top + i * 25;

      ctx.fillStyle = signal.color;
      ctx.beginPath();
      ctx.arc(legendX, legendY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.textAlign = 'left';
      ctx.fillText(signal.label, legendX + 12, legendY + 4);
    });
  }, [data]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 30, right: 120, bottom: 50, left: 50 };
    const chartWidth = rect.width - padding.left - padding.right;
    const chartHeight = rect.height - padding.top - padding.bottom;

    const signals = [
      { key: 'confidence', label: 'Confidence' },
      { key: 'ownership', label: 'Ownership' },
      { key: 'hesitation', label: 'Hesitation' },
      { key: 'recovery', label: 'Recovery' },
      { key: 'clarity', label: 'Clarity' }
    ];

    let closest: any = null;
    let minDist = Infinity;

    data.forEach((point, i) => {
      signals.forEach((signal) => {
        const px = padding.left + (chartWidth / (data.length - 1)) * i;
        const value = point[signal.key as keyof BehavioralData] as number;
        const py = padding.top + chartHeight - (value / 100) * chartHeight;

        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < 15 && dist < minDist) {
          minDist = dist;
          closest = {
            signal: signal.label,
            value: value,
            date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            x: px,
            y: py
          };
        }
      });
    });

    setHoveredPoint(closest);
  };

  return (
    <div className="relative">
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
            top: `${hoveredPoint.y - 60}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-semibold">{hoveredPoint.signal}</div>
          <div className="text-xs opacity-90">{hoveredPoint.value}%</div>
          <div className="text-xs opacity-75">{hoveredPoint.date}</div>
        </motion.div>
      )}
    </div>
  );
}
