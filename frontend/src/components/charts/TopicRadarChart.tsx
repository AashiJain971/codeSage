'use client';

import { motion } from 'framer-motion';

interface TopicData {
  topic: string;
  average_score: number;
  attempts: number;
  max_score: number;
  min_score: number;
}

interface TopicRadarChartProps {
  data: TopicData[];
}

export default function TopicRadarChart({ data }: TopicRadarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No topic data available
      </div>
    );
  }

  // Limit to top 6 topics for better visualization
  const topTopics = data.slice(0, 6);
  
  const centerX = 150;
  const centerY = 150;
  const radius = 100;
  const maxScore = 100;

  // Calculate polygon points
  const angleStep = (2 * Math.PI) / topTopics.length;
  
  const points = topTopics.map((topic, index) => {
    const angle = angleStep * index - Math.PI / 2; // Start from top
    const distance = (topic.average_score / maxScore) * radius;
    return {
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      labelX: centerX + Math.cos(angle) * (radius + 30),
      labelY: centerY + Math.sin(angle) * (radius + 30),
      ...topic
    };
  });

  // Create polygon path
  const polygonPath = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ') + ' Z';

  // Create grid circles
  const gridLevels = [20, 40, 60, 80, 100];

  // Create grid lines (axes)
  const gridLines = topTopics.map((_, index) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x1: centerX,
      y1: centerY,
      x2: centerX + Math.cos(angle) * radius,
      y2: centerY + Math.sin(angle) * radius
    };
  });

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Topic Performance Radar</h3>
      
      <div className="flex items-center justify-center">
        <svg viewBox="0 0 300 300" className="w-full max-w-md h-auto">
          {/* Grid circles */}
          {gridLevels.map((level) => (
            <circle
              key={level}
              cx={centerX}
              cy={centerY}
              r={(level / maxScore) * radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Grid lines */}
          {gridLines.map((line, index) => (
            <line
              key={index}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}

          {/* Score level labels */}
          {gridLevels.map((level) => (
            <text
              key={`label-${level}`}
              x={centerX + 5}
              y={centerY - (level / maxScore) * radius}
              fontSize="10"
              fill="#9ca3af"
            >
              {level}
            </text>
          ))}

          {/* Filled polygon */}
          <motion.path
            d={polygonPath}
            fill="url(#radarGradient)"
            stroke="#06b6d4"
            strokeWidth="2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Data points */}
          {points.map((point, index) => (
            <motion.circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="5"
              fill="#06b6d4"
              stroke="white"
              strokeWidth="2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.3 }}
              className="cursor-pointer"
            >
              <title>
                {point.topic}
                {'\n'}Avg Score: {point.average_score}%
                {'\n'}Attempts: {point.attempts}
              </title>
            </motion.circle>
          ))}

          {/* Topic labels */}
          {points.map((point, index) => {
            const angle = angleStep * index - Math.PI / 2;
            const textAnchor = 
              Math.abs(angle) < Math.PI / 4 || Math.abs(angle) > (3 * Math.PI) / 4
                ? 'middle'
                : angle > 0 ? 'start' : 'end';
            
            return (
              <text
                key={`topic-${index}`}
                x={point.labelX}
                y={point.labelY}
                textAnchor={textAnchor}
                fontSize="12"
                fontWeight="600"
                fill="#374151"
                className="pointer-events-none"
              >
                {point.topic}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {topTopics.map((topic, index) => (
          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">{topic.topic}</span>
            <span className={`text-sm font-bold ${
              topic.average_score >= 80 ? 'text-green-600' :
              topic.average_score >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {topic.average_score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
