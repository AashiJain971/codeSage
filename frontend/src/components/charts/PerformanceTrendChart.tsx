'use client';

import { useEffect, useRef, useState } from 'react';

interface PerformanceTrendChartProps {
  scores: number[];
  dates: string[];
}

export default function PerformanceTrendChart({ scores, dates }: PerformanceTrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{score: number; date: string; x: number; y: number} | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 300 });

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current?.parentElement) {
        const width = canvasRef.current.parentElement.clientWidth;
        setDimensions({ width, height: 300 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || scores.length === 0 || dimensions.width === 0) return;

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

    const padding = { top: 30, right: 20, bottom: 60, left: 60 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    // Clear canvas with gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);
    bgGradient.addColorStop(0, '#fafafa');
    bgGradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw grid lines
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Horizontal grid lines (score)
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${100 - i * 20}%`, padding.left - 10, y);
    }

    // Draw axes
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#4b5563';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Interview Timeline →', dimensions.width / 2, dimensions.height - 10);

    // Y-axis label
    ctx.save();
    ctx.translate(15, dimensions.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Score (%) →', 0, 0);
    ctx.restore();

    // Calculate point positions
    const pointSpacing = chartWidth / Math.max(scores.length - 1, 1);
    const points: { x: number; y: number; score: number; date: string }[] = [];

    scores.forEach((score, index) => {
      const x = padding.left + index * pointSpacing;
      const y = padding.top + chartHeight - (score / 100) * chartHeight;
      points.push({ x, y, score, date: dates[index] });
    });

    // Draw gradient area under line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    
    points.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    
    ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fill();

    // Draw line
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.beginPath();

    points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    ctx.stroke();

    // Draw data points
    points.forEach((point, index) => {
      // Outer circle
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Inner circle
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });

    // X-axis date labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    dates.forEach((date, index) => {
      if (index % Math.ceil(dates.length / 8) === 0 || index === dates.length - 1) {
        const x = padding.left + index * pointSpacing;
        const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        ctx.fillText(formattedDate, x, padding.top + chartHeight + 10);
      }
    });

    // Draw hover tooltip if point is hovered
    if (hoveredPoint) {
      const tooltipWidth = 120;
      const tooltipHeight = 50;
      let tooltipX = hoveredPoint.x - tooltipWidth / 2;
      let tooltipY = hoveredPoint.y - tooltipHeight - 15;

      // Keep tooltip within canvas bounds
      if (tooltipX < 10) tooltipX = 10;
      if (tooltipX + tooltipWidth > dimensions.width - 10) {
        tooltipX = dimensions.width - tooltipWidth - 10;
      }
      if (tooltipY < 10) tooltipY = hoveredPoint.y + 15;

      // Draw tooltip background
      ctx.fillStyle = 'rgba(31, 41, 55, 0.95)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
      ctx.fill();

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Draw tooltip text
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${hoveredPoint.score}%`, tooltipX + tooltipWidth / 2, tooltipY + 18);

      ctx.font = '11px Inter, sans-serif';
      ctx.fillStyle = '#d1d5db';
      ctx.fillText(
        new Date(hoveredPoint.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        tooltipX + tooltipWidth / 2,
        tooltipY + 35
      );
    }
  }, [scores, dates, dimensions, hoveredPoint]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || scores.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 40, right: 30, bottom: 70, left: 70 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;
    const pointSpacing = chartWidth / Math.max(scores.length - 1, 1);

    let found = false;
    scores.forEach((score, index) => {
      const px = padding.left + index * pointSpacing;
      const py = padding.top + chartHeight - (score / 100) * chartHeight;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (dist < 10) {
        canvasRef.current!.style.cursor = 'pointer';
        setHoveredPoint({ score, date: dates[index], x: px, y: py });
        found = true;
      }
    });

    if (!found) {
      canvasRef.current.style.cursor = 'default';
      setHoveredPoint(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ width: '100%', height: '300px' }}
    />
  );
}
