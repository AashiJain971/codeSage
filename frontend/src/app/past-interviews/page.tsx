'use client';

import { motion } from 'framer-motion';
import { 
  Calendar, Clock, User, CheckCircle, XCircle, Trophy, Code2, 
  FileText, Star, TrendingUp, Download, Filter, Search, X,
  BarChart3, Activity
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import Navbar from '../../components/Navbar';
import ScoreTrendChart from '../../components/charts/ScoreTrendChart';
import TopicRadarChart from '../../components/charts/TopicRadarChart';
import ScoreDistributionChart from '../../components/charts/ScoreDistributionChart';
import ActivityHeatmap from '../../components/charts/ActivityHeatmap';
import PerformanceInsightsPanel from '../../components/analytics/PerformanceInsightsPanel';
import { Interview, PerformanceAnalytics, PerformanceInsights } from '../../types/interview';
import { 
  filterInterviews, 
  sortInterviews, 
  getAllTopics, 
  calculateStats,
  formatDate,
  getScoreColor,
  getStatusColor,
  FilterOptions,
  defaultFilters
} from '../../utils/interviewUtils';

export default function PastInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true); // Track first load
  const [filters, setFilters] = useState<FilterOptions>(defaultFilters);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'duration' | 'questions'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Analytics data
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);

  // Fetch interviews with server-side filtering
  const fetchInterviews = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Build query params for server-side filtering
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '200');  // Reduced for faster loading - can increase if needed
      
      if (filters.status !== 'all') {
        params.append('status_filter', filters.status);
      }
      if (filters.interviewType !== 'all') {
        params.append('interview_type', filters.interviewType);
      }
      if (filters.scoreRange.min > 0) {
        params.append('min_score', filters.scoreRange.min.toString());
      }
      if (filters.scoreRange.max < 100) {
        params.append('max_score', filters.scoreRange.max.toString());
      }
      
      const response = await fetch(`/api/interviews?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch interviews');
      }
      
      const data = await response.json();
      
      // Backend returns { interviews: [], total, page, etc. }
      if (data.interviews && Array.isArray(data.interviews)) {
        setInterviews(data.interviews);
      } else if (data.error) {
        setError(data.message || 'Failed to fetch interviews');
        setInterviews([]);
      } else {
        console.warn('No interviews data received');
        setInterviews([]);
      }
    } catch (error) {
      console.error('Error fetching interviews:', error);
      setError('Unable to connect to the backend. Please ensure the server is running.');
      setInterviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialLoad(false); // Mark initial load complete
    }
  };

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchInterviews();
  }, [filters.status, filters.interviewType, filters.scoreRange]);

  // Fetch analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [analyticsRes, insightsRes] = await Promise.all([
          fetch('/api/interviews/analytics'),
          fetch('/api/interviews/insights')
        ]);
        
        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        }
        
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          setInsights(insightsData);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    };

    if (interviews.length > 0) {
      fetchAnalytics();
    }
  }, [interviews]);

  // Filter and sort interviews
  const processedInterviews = useMemo(() => {
    const filtered = filterInterviews(interviews, filters);
    return sortInterviews(filtered, sortBy, sortOrder);
  }, [interviews, filters, sortBy, sortOrder]);

  // Get stats
  const stats = useMemo(() => calculateStats(processedInterviews), [processedInterviews]);

  // Get all available topics
  const availableTopics = useMemo(() => getAllTopics(interviews), [interviews]);

  // Handle export with filters
  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = new URLSearchParams({ format });
      if (filters.status !== 'all') {
        params.append('status_filter', filters.status);
      }
      
      const API_BASE = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${API_BASE}/api/interviews/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interviews_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`Exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusIcon = (status: string) => {
    return status === 'approved' ? CheckCircle : XCircle;
  };

  // Show clean loading screen only on very first load
  if (initialLoad && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-cyan-50 to-violet-50">
        <Navbar theme="light" />
        <div className="pt-20 flex items-center justify-center min-h-[80vh]">
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
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Past <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">Interviews</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Track your interview progress and performance over time
            </p>
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-3 mb-8 justify-center"
          >
            <button
              onClick={() => {
                setRefreshing(true);
                fetchInterviews();
              }}
              disabled={refreshing || loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-cyan-600 rounded-full animate-spin" />
              ) : (
                <Activity className="w-4 h-4" />
              )}
              <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
            
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showAnalytics
                  ? 'bg-cyan-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>{showAnalytics ? 'Hide' : 'Show'} Analytics</span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export JSON</span>
              </button>
            </div>
          </motion.div>

          {/* Error Banner */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <XCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Filter Panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-8 bg-white rounded-xl p-6 shadow-lg border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => setFilters(defaultFilters)}
                  className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                >
                  Reset All
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={filters.searchQuery}
                      onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                      placeholder="Search interviews..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg 
                                 focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                                 bg-white text-gray-900 placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg 
                               focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                               bg-white text-gray-900"
                  >
                    <option value="all">All Statuses</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="manually_ended">Manually Ended</option>
                    <option value="timeout">Timeout</option>
                  </select>
                </div>

                {/* Interview Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Interview Type
                  </label>
                  <select
                    value={filters.interviewType}
                    onChange={(e) => setFilters({ ...filters, interviewType: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg 
                               focus:ring-2 focus:ring-cyan-500 focus:border-transparent
                               bg-white text-gray-900"
                  >
                    <option value="all">All Types</option>
                    <option value="technical">Technical</option>
                    <option value="resume">Resume</option>
                  </select>
                </div>

                {/* Score Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Score Range: {filters.scoreRange.min}% - {filters.scoreRange.max}%
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600 min-w-[40px]">{filters.scoreRange.min}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filters.scoreRange.min}
                        onChange={(e) => setFilters({ 
                          ...filters, 
                          scoreRange: { ...filters.scoreRange, min: parseInt(e.target.value) }
                        })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-cyan-600
                                   [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
                                   [&::-moz-range-thumb]:rounded-full
                                   [&::-moz-range-thumb]:bg-cyan-600
                                   [&::-moz-range-thumb]:border-0"
                      />
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600 min-w-[40px]">{filters.scoreRange.max}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filters.scoreRange.max}
                        onChange={(e) => setFilters({ 
                          ...filters, 
                          scoreRange: { ...filters.scoreRange, max: parseInt(e.target.value) }
                        })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
                                   [&::-webkit-slider-thumb]:appearance-none
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:rounded-full
                                   [&::-webkit-slider-thumb]:bg-cyan-600
                                   [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
                                   [&::-moz-range-thumb]:rounded-full
                                   [&::-moz-range-thumb]:bg-cyan-600
                                   [&::-moz-range-thumb]:border-0"
                      />
                    </div>
                  </div>
                </div>

                {/* Topics Multi-select */}
                {availableTopics.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Topics
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableTopics.map(topic => (
                        <button
                          key={topic}
                          onClick={() => {
                            const newTopics = filters.topics.includes(topic)
                              ? filters.topics.filter(t => t !== topic)
                              : [...filters.topics, topic];
                            setFilters({ ...filters, topics: newTopics });
                          }}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                            filters.topics.includes(topic)
                              ? 'bg-cyan-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {topic}
                          {filters.topics.includes(topic) && (
                            <X className="inline-block w-3 h-3 ml-1" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
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
                  <p className={`text-2xl font-bold ${getScoreColor(stats.averageScore)}`}>
                    {stats.averageScore}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </motion.div>

          {/* Analytics Dashboard */}
          {showAnalytics && analytics && insights && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <ScoreTrendChart data={analytics.improvement_trend} />
              <TopicRadarChart data={analytics.topic_performance} />
              <ScoreDistributionChart distribution={analytics.score_distribution} />
              <ActivityHeatmap interviews={interviews} />
              <div className="lg:col-span-2">
                <PerformanceInsightsPanel 
                  insights={insights} 
                  consistencyScore={analytics.consistency_score} 
                />
              </div>
            </motion.div>
          )}

          {/* Sorting Controls */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2 mb-6"
          >
            <span className="text-sm text-gray-600 flex items-center">Sort by:</span>
            {(['date', 'score', 'duration', 'questions'] as const).map(option => (
              <button
                key={option}
                onClick={() => {
                  if (sortBy === option) {
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                  } else {
                    setSortBy(option);
                    setSortOrder('desc');
                  }
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === option
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
                {sortBy === option && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
              </button>
            ))}
          </motion.div>

          {/* Interview Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {processedInterviews.map((interview, index) => {
              const StatusIcon = getStatusIcon(interview.status);
              
              return (
                <motion.div
                  key={interview.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
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
                          <p className="text-sm text-gray-500 truncate max-w-[200px]">
                            ID: {interview.id}
                          </p>
                        </div>
                      </div>
                      
                      <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getStatusColor(interview.status)}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm font-medium capitalize">
                          {interview.status.replace('_', ' ')}
                        </span>
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

                    {/* Topics */}
                    {interview.topics && interview.topics.length > 0 && (
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
                      <p className="text-sm text-gray-600">
                        Interviewer: <span className="text-gray-900 font-medium">{interview.interviewer}</span>
                      </p>
                    </div>

                    {/* Feedback */}
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Feedback:</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg line-clamp-3">
                        {interview.feedback}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Loading State - Show skeleton while loading */}
          {loading && processedInterviews.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
              <p className="text-gray-600">Loading interviews...</p>
            </motion.div>
          )}

          {/* Empty State - Only show when NOT loading and no data */}
          {!loading && processedInterviews.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No interviews found</h3>
              <p className="text-gray-600 mb-6">
                {interviews.length === 0
                  ? "No interview records available. Complete some interviews to see your progress here!"
                  : "No interviews match your current filters. Try adjusting your search criteria."}
              </p>
              {interviews.length > 0 && (
                <button
                  onClick={() => setFilters(defaultFilters)}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-violet-700 transition-colors"
                >
                  Reset Filters
                </button>
              )}
              {interviews.length === 0 && (
                <a
                  href="/interview"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white font-semibold rounded-lg hover:from-cyan-700 hover:to-violet-700 transition-colors"
                >
                  Start New Interview
                </a>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
