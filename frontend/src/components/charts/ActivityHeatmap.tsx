'use client';

import { motion } from 'framer-motion';
import { Calendar } from 'lucide-react';
import { useState } from 'react';

interface Interview {
  id: string;
  date: string;
  score: number;
  status: string;
  type: string;
}

interface ActivityHeatmapProps {
  interviews: Interview[];
}

export default function ActivityHeatmap({ interviews }: ActivityHeatmapProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get last 12 weeks
  const weeks = 12;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (weeks * 7));

  // Create a map of dates to interview counts
  const dateMap = new Map<string, { count: number; avgScore: number; interviews: Interview[] }>();
  
  interviews.forEach(interview => {
    // Validate and parse date safely
    if (!interview.date) return;
    
    const dateObj = new Date(interview.date);
    if (isNaN(dateObj.getTime())) return; // Skip invalid dates
    
    const date = dateObj.toISOString().split('T')[0];
    if (!dateMap.has(date)) {
      dateMap.set(date, { count: 0, avgScore: 0, interviews: [] });
    }
    const entry = dateMap.get(date)!;
    entry.count++;
    entry.interviews.push(interview);
    entry.avgScore = entry.interviews.reduce((sum, i) => sum + i.score, 0) / entry.interviews.length;
  });

  // Create weeks array
  const weeksData = [];
  for (let week = 0; week < weeks; week++) {
    const days = [];
    for (let day = 0; day < 7; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (week * 7) + day);
      const dateStr = currentDate.toISOString().split('T')[0];
      const data = dateMap.get(dateStr) || { count: 0, avgScore: 0, interviews: [] };
      
      days.push({
        date: currentDate,
        dateStr,
        ...data
      });
    }
    weeksData.push(days);
  }

  // Get intensity color based on count
  const getIntensityColor = (count: number): string => {
    if (count === 0) return 'bg-gray-100';
    if (count === 1) return 'bg-cyan-200';
    if (count === 2) return 'bg-cyan-400';
    if (count === 3) return 'bg-cyan-600';
    return 'bg-cyan-800';
  };

  const getDayLabel = (day: number): string => {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-cyan-600" />
          <h3 className="text-lg font-semibold text-gray-900">Activity Heatmap</h3>
        </div>
        <div className="flex items-center space-x-2 text-xs text-gray-600">
          <span>Less</span>
          <div className="flex space-x-1">
            {[0, 1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={`w-3 h-3 rounded ${getIntensityColor(level)}`}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col space-y-1">
          {/* Day labels */}
          <div className="flex">
            <div className="w-8"></div>
            {weeksData[0]?.map((_, dayIndex) => (
              <div
                key={dayIndex}
                className="w-4 h-4 flex items-center justify-center text-xs text-gray-500"
              >
                {dayIndex === 0 || dayIndex === 3 || dayIndex === 6 ? getDayLabel(dayIndex)[0] : ''}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeksData.map((week, weekIndex) => (
            <div key={weekIndex} className="flex space-x-1">
              <div className="w-8 flex items-center text-xs text-gray-500">
                {weekIndex % 2 === 0 ? `W${weekIndex + 1}` : ''}
              </div>
              {week.map((day, dayIndex) => (
                <motion.div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`w-4 h-4 rounded-sm ${getIntensityColor(day.count)} cursor-pointer transition-transform hover:scale-125`}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (weekIndex * 7 + dayIndex) * 0.01 }}
                  onMouseEnter={() => setSelectedDate(day.dateStr)}
                  onMouseLeave={() => setSelectedDate(null)}
                  title={`${day.date.toLocaleDateString()}: ${day.count} interviews${day.count > 0 ? ` (Avg: ${Math.round(day.avgScore)}%)` : ''}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Selected date info */}
      {selectedDate && dateMap.has(selectedDate) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-gray-50 rounded-lg"
        >
          <p className="text-sm font-medium text-gray-900">
            {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {dateMap.get(selectedDate)!.count} interviews completed
            • Average score: {Math.round(dateMap.get(selectedDate)!.avgScore)}%
          </p>
        </motion.div>
      )}

      {/* Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900">
            {Array.from(dateMap.values()).filter(d => d.count > 0).length}
          </p>
          <p className="text-xs text-gray-600">Active Days</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-cyan-600">
            {Math.max(...Array.from(dateMap.values()).map(d => d.count), 0)}
          </p>
          <p className="text-xs text-gray-600">Max/Day</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-violet-600">
            {(Array.from(dateMap.values()).filter(d => d.count > 0).length / (weeks * 7) * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-600">Activity Rate</p>
        </div>
      </div>
    </div>
  );
}
