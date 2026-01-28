'use client';

import { motion } from 'framer-motion';
import { Calendar, Award } from 'lucide-react';

interface Interview {
  id: string;
  type: string;
  date: string;
  score: number;
  topics: string[];
  duration: number;
}

interface InterviewTimelineChartProps {
  interviews: Interview[];
}

export default function InterviewTimelineChart({ interviews }: InterviewTimelineChartProps) {
  const sortedInterviews = [...interviews].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  // Group interviews by month
  const groupedByMonth = sortedInterviews.reduce((acc, interview) => {
    const date = new Date(interview.date);
    const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(interview);
    return acc;
  }, {} as Record<string, Interview[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedByMonth).map(([month, monthInterviews], monthIdx) => (
        <div key={month} className="relative">
          {/* Month Header */}
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">{month}</h3>
            <span className="text-sm text-gray-500">({monthInterviews.length} interview{monthInterviews.length > 1 ? 's' : ''})</span>
          </div>

          {/* Timeline */}
          <div className="relative pl-8 space-y-6">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-purple-300" />

            {monthInterviews.map((interview, idx) => (
              <motion.div
                key={interview.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: monthIdx * 0.1 + idx * 0.05 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div className={`absolute -left-5 top-3 w-4 h-4 rounded-full ${getScoreColor(interview.score)} border-2 border-white shadow`} />

                {/* Interview card */}
                <div className={`border rounded-lg p-4 ${getScoreBgColor(interview.score)}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 capitalize">{interview.type} Interview</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(interview.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className={`w-5 h-5 ${interview.score >= 80 ? 'text-green-600' : interview.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`} />
                      <span className="text-2xl font-bold text-gray-900">{interview.score}%</span>
                    </div>
                  </div>

                  {/* Topics */}
                  {interview.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {interview.topics.slice(0, 4).map((topic, i) => (
                        <span key={i} className="px-2 py-1 bg-white bg-opacity-70 text-gray-700 text-xs rounded-full border border-gray-300">
                          {topic}
                        </span>
                      ))}
                      {interview.topics.length > 4 && (
                        <span className="px-2 py-1 bg-white bg-opacity-70 text-gray-500 text-xs rounded-full border border-gray-300">
                          +{interview.topics.length - 4} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Duration */}
                  <p className="text-xs text-gray-500 mt-2">Duration: {interview.duration} minutes</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
