'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface DataPoint {
  date: string;
  score: number;
  interview_number: number;
}

interface ScoreTrendChartProps {
  data: DataPoint[];
}

export default function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No data available for trend analysis
      </div>
    );
  }

  // Filter out any data points with invalid dates
  const validData = data.filter(point => {
    const date = new Date(point.date);
    return !isNaN(date.getTime());
  });

  if (validData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No valid data available for trend analysis
      </div>
    );
  }

  const maxScore = 100;
  const chartHeight = 200;
  const chartWidth = 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };

  // Calculate dimensions
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Create points for the line
  const points = validData.map((point, index) => {
    const x = padding.left + (index / (validData.length - 1 || 1)) * innerWidth;
    const y = padding.top + (1 - point.score / maxScore) * innerHeight;
    return { x, y, ...point };
  });

  // Create path string for the line
  const pathData = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ');

  // Create path for gradient fill
  const areaData = `${pathData} L ${points[points.length - 1].x},${chartHeight - padding.bottom} L ${padding.left},${chartHeight - padding.bottom} Z`;

  // Calculate trend
  const firstScore = validData[0].score;
  const lastScore = validData[validData.length - 1].score;
  const trend = lastScore - firstScore;
  const trendPercent = ((trend / firstScore) * 100).toFixed(1);

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Score Trend</h3>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
          trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {trend >= 0 ? '+' : ''}{trendPercent}%
          </span>
        </div>
      </div>

      <div className="relative">
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-auto"
          style={{ minHeight: '200px' }}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => {
            const y = padding.top + (1 - value / maxScore) * innerHeight;
            return (
              <g key={value}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={chartWidth - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#6b7280"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Gradient for area fill */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <motion.path
            d={areaData}
            fill="url(#scoreGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Line */}
          <motion.path
            d={pathData}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <motion.circle
                cx={point.x}
                cy={point.y}
                r="6"
                fill="white"
                stroke="#06b6d4"
                strokeWidth="3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
              />
              
              {/* Tooltip on hover */}
              <circle
                cx={point.x}
                cy={point.y}
                r="15"
                fill="transparent"
                className="cursor-pointer hover:fill-cyan-50 transition-all"
              >
                <title>
                  Interview #{point.interview_number}
                  {'\n'}Score: {point.score}
                  {'\n'}{new Date(point.date).toLocaleDateString()}
                </title>
              </circle>
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            if (validData.length <= 5 || index % Math.ceil(validData.length / 5) === 0) {
              return (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={chartHeight - padding.bottom + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#6b7280"
                >
                  #{point.interview_number}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <div>
          <span className="font-medium text-gray-900">First: </span>
          <span className={firstScore >= 70 ? 'text-green-600' : 'text-red-600'}>
            {firstScore}%
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-900">Latest: </span>
          <span className={lastScore >= 70 ? 'text-green-600' : 'text-red-600'}>
            {lastScore}%
          </span>
        </div>
        <div>
          <span className="font-medium text-gray-900">Interviews: </span>
          {validData.length}
        </div>
      </div>
    </div>
  );
}
