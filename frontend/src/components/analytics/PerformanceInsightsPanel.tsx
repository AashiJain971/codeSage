'use client';

import { motion } from 'framer-motion';
import { Target, TrendingUp, Award, AlertCircle } from 'lucide-react';

interface Strength {
  topic: string;
  average_score: number;
  description: string;
}

interface Weakness {
  topic: string;
  average_score: number;
  description: string;
}

interface Recommendation {
  category: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

interface InsightsData {
  strengths: Strength[];
  areas_for_improvement: Weakness[];
  recommendations: Recommendation[];
}

interface PerformanceInsightsPanelProps {
  insights: InsightsData;
  consistencyScore: number;
}

export default function PerformanceInsightsPanel({ insights, consistencyScore }: PerformanceInsightsPanelProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <div className="flex items-center space-x-2 mb-6">
        <Target className="w-5 h-5 text-violet-600" />
        <h3 className="text-lg font-semibold text-gray-900">Performance Insights</h3>
      </div>

      {/* Consistency Score */}
      <div className="mb-6 p-4 bg-gradient-to-r from-cyan-50 to-violet-50 rounded-lg border border-cyan-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Consistency Score</p>
            <p className="text-xs text-gray-600 mt-1">
              How stable your performance is across interviews
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">
              {consistencyScore}
            </p>
            <p className="text-xs text-gray-500">out of 100</p>
          </div>
        </div>
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-gradient-to-r from-cyan-500 to-violet-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${consistencyScore}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
        </div>
      </div>

      {/* Strengths */}
      {insights.strengths && insights.strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex items-center space-x-2 mb-3">
            <Award className="w-4 h-4 text-green-600" />
            <h4 className="font-semibold text-gray-900">Strengths</h4>
          </div>
          <div className="space-y-2">
            {insights.strengths.map((strength, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{strength.topic}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{strength.description}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{strength.average_score}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Areas for Improvement */}
      {insights.areas_for_improvement && insights.areas_for_improvement.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center space-x-2 mb-3">
            <TrendingUp className="w-4 h-4 text-orange-600" />
            <h4 className="font-semibold text-gray-900">Areas for Improvement</h4>
          </div>
          <div className="space-y-2">
            {insights.areas_for_improvement.map((area, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{area.topic}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{area.description}</p>
                </div>
                <span className="text-sm font-bold text-orange-600">{area.average_score}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recommendations */}
      {insights.recommendations && insights.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center space-x-2 mb-3">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <h4 className="font-semibold text-gray-900">Recommendations</h4>
          </div>
          <div className="space-y-2">
            {insights.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className={`p-3 border rounded-lg ${getPriorityColor(rec.priority)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-lg">{getPriorityIcon(rec.priority)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{rec.category}</p>
                    <p className="text-xs mt-1">{rec.suggestion}</p>
                  </div>
                  <span className="text-xs font-medium uppercase">{rec.priority}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {(!insights.strengths || insights.strengths.length === 0) &&
       (!insights.areas_for_improvement || insights.areas_for_improvement.length === 0) &&
       (!insights.recommendations || insights.recommendations.length === 0) && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-sm">Complete more interviews to see personalized insights</p>
        </div>
      )}
    </div>
  );
}
