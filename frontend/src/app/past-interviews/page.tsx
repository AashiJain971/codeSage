'use client';

import { motion } from 'framer-motion';
import { Calendar, Clock, User, CheckCircle, XCircle, Trophy, Code2, FileText, Star, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';

interface Interview {
  id: string;
  type: 'technical' | 'resume';
  date: string;
  duration: number; // in minutes
  score: number;
  status: 'approved' | 'rejected';
  topics?: string[];
  questions_completed: number;
  total_questions: number;
  interviewer: string;
  feedback: string;
}

export default function PastInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score'>('date');

  // Fetch real data from Supabase database
  useEffect(() => {
    const fetchInterviews = async () => {
      setLoading(true);
      
      try {
        const response = await fetch('/api/interviews');
        
        if (!response.ok) {
          throw new Error('Failed to fetch interviews');
        }
        
        const data = await response.json();
        console.log('Fetched interviews data:', data); // Debug log
        
        // Handle both success and error cases gracefully
        if (data.interviews && Array.isArray(data.interviews)) {
          setInterviews(data.interviews);
        } else {
          console.warn('No interviews data received:', data.message || 'Unknown reason');
          setInterviews([]);
        }
      } catch (error) {
        console.error('Error fetching interviews:', error);
        // Fallback to empty array if API fails
        setInterviews([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInterviews();
  }, []);

  const filteredInterviews = interviews
    .filter(interview => filter === 'all' || interview.status === filter)
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else {
        return b.score - a.score;
      }
    });

  const getStatusColor = (status: string) => {
    return status === 'approved' 
      ? 'text-green-600 bg-green-100' 
      : 'text-red-600 bg-red-100';
  };

  const getStatusIcon = (status: string) => {
    return status === 'approved' ? CheckCircle : XCircle;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const stats = {
    total: interviews.length,
    approved: interviews.filter(i => i.status === 'approved').length,
    rejected: interviews.filter(i => i.status === 'rejected').length,
    averageScore: interviews.length > 0 ? Math.round(interviews.reduce((acc, i) => acc + i.score, 0) / interviews.length) : 0
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-violet-50">
        <Navbar theme="light" />
        <div className="pt-20 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-gray-600">Loading your interview history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-violet-50">
      <Navbar theme="light" />
      
      <div className="pt-20 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Past <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">Interviews</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track your interview progress and performance over time
            </p>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Total Interviews</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <User className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">Average Score</p>
                  <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>{stats.averageScore}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4 mb-8"
          >
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'approved'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'rejected'
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Rejected
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sortBy === 'date'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Sort by Date
              </button>
              <button
                onClick={() => setSortBy('score')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  sortBy === 'score'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Sort by Score
              </button>
            </div>
          </motion.div>

          {/* Interview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredInterviews.map((interview, index) => {
              const StatusIcon = getStatusIcon(interview.status);
              
              return (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {interview.type === 'technical' ? (
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Code2 className="w-5 h-5 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <FileText className="w-5 h-5 text-purple-600" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-gray-900 capitalize">
                            {interview.type} Interview
                          </h3>
                          <p className="text-sm text-gray-500">ID: {interview.id}</p>
                        </div>
                      </div>
                      
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(interview.status)}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm font-medium capitalize">{interview.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(interview.date)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{interview.duration} min</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6">
                    {/* Score */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <span className="text-gray-600">Score:</span>
                      </div>
                      <span className={`text-2xl font-bold ${getScoreColor(interview.score)}`}>
                        {interview.score}%
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Questions Completed</span>
                        <span className="text-sm text-gray-900 font-medium">
                          {interview.questions_completed}/{interview.total_questions}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-violet-500 h-2 rounded-full"
                          style={{
                            width: `${(interview.questions_completed / interview.total_questions) * 100}%`
                          }}
                        />
                      </div>
                    </div>

                    {/* Topics (for technical interviews) */}
                    {interview.topics && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">Topics:</p>
                        <div className="flex flex-wrap gap-2">
                          {interview.topics.map((topic, topicIndex) => (
                            <span
                              key={topicIndex}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interviewer */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">Interviewer: <span className="text-gray-900 font-medium">{interview.interviewer}</span></p>
                    </div>

                    {/* Feedback */}
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Feedback:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {interview.feedback}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredInterviews.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No interviews found</h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all' 
                  ? "No interview records available. Complete some interviews to see your progress here!"
                  : `No ${filter} interviews found. Try changing the filter or complete more interviews.`
                }
              </p>
              <div className="space-y-4">
                <a
                  href="/interview"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-violet-700 transition-colors"
                >
                  Start New Interview
                </a>
                {interviews.length > 0 && filteredInterviews.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Showing {interviews.length} total interviews, but none match your current filter.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}