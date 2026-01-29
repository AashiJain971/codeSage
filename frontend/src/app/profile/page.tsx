'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Award, TrendingUp, Target, CheckCircle, CheckCircle2, Brain, 
  Share2, Lock, Unlock, Copy, ExternalLink, Calendar,
  Code2, MessageSquare, Zap, Eye, Download, BarChart3,
  Trophy, Shield, Clock, FileText, Star, AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBase, authenticatedFetch } from '@/lib/api';
import SkillRadarChart from '@/components/charts/SkillRadarChart';
import PerformanceTrendChart from '@/components/charts/PerformanceTrendChart';
import LanguageDistributionChart from '@/components/charts/LanguageDistributionChart';
import InterviewTimelineChart from '@/components/charts/InterviewTimelineChart';
import SkillDistributionChart from '@/components/charts/SkillDistributionChart';
import BehavioralSignalEvolutionChart from '@/components/charts/BehavioralSignalEvolutionChart';
import ProcessEfficiencyChart from '@/components/charts/ProcessEfficiencyChart';
import DifficultyScatterChart from '@/components/charts/DifficultyScatterChart';
import TopicHeatmap from '@/components/charts/TopicHeatmap';
import QuestionFunnelChart from '@/components/charts/QuestionFunnelChart';

interface ProfileData {
  user: {
    id: string;
    email: string;
    name?: string;
    created_at: string;
  };
  stats: {
    total_interviews: number;
    average_score: number;
    highest_score: number;
    total_duration_hours: number;
    total_questions: number;
    completion_rate: number;
  };
  skills: {
    problem_solving: number;
    communication: number;
    code_quality: number;
    technical_depth: number;
    system_design: number;
    behavioral: number;
  };
  performance: {
    trend: 'improving' | 'stable' | 'declining';
    recent_scores: number[];
    dates: string[];
  };
  interviews: {
    id: string;
    type: string;
    date: string;
    score: number;
    topics: string[];
    duration: number;
    final_results?: any;
    questions_data?: any[];
    code_submissions?: any[];
    voice_responses?: any[];
  }[];
  strengths: string[];
  improvements: string[];
  swot_analysis?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    current_stage: string;
    longitudinal_growth: string;
    key_recommendations: string[];
    technical_readiness: { score: number; justification: string };
    behavioral_readiness: { score: number; justification: string };
    detailed_breakdown: {
      hard_skills: { assessment: string; score: number };
      soft_skills: { assessment: string; score: number };
      problem_solving: { assessment: string; score: number };
      communication: { assessment: string; score: number };
      consistency: { assessment: string; score: number };
      growth_mindset: { assessment: string; score: number };
    };
  };
  shareableUrl?: string;
  trustScore: number;
}

function ProfilePage() {
  const { user, getToken } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'private' | 'public'>('private');
  const [shareableLink, setShareableLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [expandedInterview, setExpandedInterview] = useState<string | null>(null);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await getToken();
      if (!token) {
        setError('Not authenticated. Please login.');
        setLoading(false);
        return;
      }
      
      const apiBase = getApiBase();
      const response = await authenticatedFetch(
        `${apiBase}/api/profile`,
        token
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }
      
      const data = await response.json();
      setProfileData(data);
      
      // Generate shareable link
      if (data.user?.id) {
        const publicUrl = `${window.location.origin}/profile/public/${data.user.id}`;
        setShareableLink(publicUrl);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleInterview = (interviewId: string) => {
    setExpandedInterview(expandedInterview === interviewId ? null : interviewId);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'declining':
        return <TrendingUp className="w-5 h-5 text-red-500 rotate-180" />;
      default:
        return <Target className="w-5 h-5 text-blue-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600 bg-green-50';
      case 'declining':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Navbar theme="light" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            />
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Navbar theme="light" />
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Failed to load profile'}</p>
            <button
              onClick={fetchProfileData}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar theme="light" />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl" style={{ paddingTop: '6rem' }}>
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            {/* <div>
              <h1 className="text-4xl font-bold mb-2">
                Interview <span className="bg-gradient-to-r from-cyan-600 to-violet-600 bg-clip-text text-transparent">Profile</span>
              </h1>
              <p className="text-gray-600">Your portable, verified interview credential</p>
            </div>
             */}
            {/* View Mode Toggle */}
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg shadow-md p-1 flex">
                <button
                  onClick={() => setViewMode('private')}
                  className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                    viewMode === 'private'
                      ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  Private View
                </button>
                <button
                  onClick={() => setViewMode('public')}
                  className={`px-4 py-2 rounded-md transition flex items-center gap-2 ${
                    viewMode === 'public'
                      ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Public View
                </button>
              </div>
              
              {/* Share Button */}
              <button
                onClick={copyShareableLink}
                className="px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition flex items-center gap-2 text-gray-700 hover:text-blue-600"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    Share Profile
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Trust & Verification Badge */}
          <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Verified Interview Profile</h3>
                <p className="text-sm text-gray-600">
                  AI-evaluated • Session-backed • Trust Score: <span className="font-bold text-green-600">{profileData.trustScore}%</span>
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Member since</p>
              <p className="font-medium text-gray-900">
                {new Date(profileData.user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {/* Total Interviews */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-8 h-8 text-blue-500" />
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTrendColor(profileData.performance.trend)}`}>
                {getTrendIcon(profileData.performance.trend)}
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{profileData.stats.total_interviews}</h3>
            <p className="text-gray-600 text-sm">Total Interviews</p>
          </div>

          {/* Average Score */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Trophy className="w-8 h-8 text-yellow-500 mb-2" />
            <h3 className={`text-3xl font-bold ${getScoreColor(profileData.stats.average_score)}`}>
              {profileData.stats.average_score.toFixed(1)}%
            </h3>
            <p className="text-gray-600 text-sm">Average Score</p>
            <p className="text-xs text-gray-500 mt-1">
              Peak: {profileData.stats.highest_score}%
            </p>
          </div>

          {/* Total Duration */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <Clock className="w-8 h-8 text-purple-500 mb-2" />
            <h3 className="text-3xl font-bold text-gray-900">
              {profileData.stats.total_duration_hours.toFixed(1)}h
            </h3>
            <p className="text-gray-600 text-sm">Interview Time</p>
          </div>

          {/* Questions Completed */}
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition">
            <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
            <h3 className="text-3xl font-bold text-gray-900">{profileData.stats.total_questions}</h3>
            <p className="text-gray-600 text-sm">Questions Solved</p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.min(Math.round(profileData.stats.completion_rate), 100)}% completion rate
            </p>
          </div>
        </motion.div>

        {/* Main Content - Changes based on view mode */}
        <AnimatePresence mode="wait">
          {viewMode === 'private' ? (
            <motion.div
              key="private"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Skills Assessment */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Brain className="w-6 h-6 text-blue-600" />
                  <h2 className="text-2xl font-bold text-gray-900">Skill Assessment</h2>
                  <span className="ml-auto text-sm text-gray-500 italic">AI-Generated from {profileData.stats.total_interviews} interviews</span>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <SkillRadarChart skills={profileData.skills} />
                  </div>
                  <div className="h-full">
                    <SkillDistributionChart skills={profileData.skills} />
                  </div>
                </div>
              </div>

              {/* Performance Analytics Grid */}
              {profileData.performance.recent_scores.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Trend */}
                  <div className="bg-white rounded-xl shadow-md p-6 overflow-hidden">
                    <div className="flex items-center gap-3 mb-6">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                      <h2 className="text-xl font-bold text-gray-900">Performance Trend</h2>
                    </div>
                    <div className="overflow-hidden">
                      <PerformanceTrendChart 
                        scores={profileData.performance.recent_scores}
                        dates={profileData.performance.dates}
                      />
                    </div>
                  </div>

                  {/* Language Distribution */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Code2 className="w-6 h-6 text-indigo-600" />
                      <h2 className="text-xl font-bold text-gray-900">Languages Used</h2>
                    </div>
                    <LanguageDistributionChart interviews={profileData.interviews} />
                  </div>
                </div>
              )}

              {/* Interview History */}
              {profileData.interviews.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Calendar className="w-6 h-6 text-green-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Interview History</h2>
                    <span className="ml-auto text-sm text-gray-500">{profileData.interviews.length} sessions completed</span>
                  </div>

                  {/* Detailed Interview Cards */}
                  <div className="mt-8 space-y-4">
                    {profileData.interviews.slice(0, 10).map((interview, idx) => (
                      <motion.div
                        key={interview.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition"
                      >
                        {/* Interview Header - Always Visible */}
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => toggleInterview(interview.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Code2 className="w-5 h-5 text-blue-500" />
                                <h3 className="font-semibold text-gray-900 capitalize">{interview.type} Interview</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreColor(interview.score)} bg-opacity-10`}>
                                  {interview.score}% Score
                                </span>
                                {interview.final_results?.hire_recommendation && (
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    interview.final_results.hire_recommendation === 'strong_yes' ? 'bg-green-100 text-green-700' :
                                    interview.final_results.hire_recommendation === 'yes' ? 'bg-green-50 text-green-600' :
                                    interview.final_results.hire_recommendation === 'borderline' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {interview.final_results.hire_recommendation.replace('_', ' ').toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {new Date(interview.date).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {formatDuration(interview.duration)}
                                </span>
                                {interview.final_results?.completed_questions && interview.final_results?.total_questions && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" />
                                    {interview.final_results.completed_questions}/{interview.final_results.total_questions} questions
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {interview.topics.map((topic, i) => (
                                  <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <motion.div
                              animate={{ rotate: expandedInterview === interview.id ? 180 : 0 }}
                              transition={{ duration: 0.3 }}
                            >
                              <TrendingUp className="w-5 h-5 text-gray-400" />
                            </motion.div>
                          </div>
                        </div>

                        {/* Expandable Details */}
                        <AnimatePresence>
                          {expandedInterview === interview.id && interview.final_results && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="border-t border-gray-200 bg-gray-50"
                            >
                              <div className="p-4 space-y-4">
                                {/* AI Overall Assessment */}
                                {interview.final_results.interview_summary?.overall_assessment && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                      <Brain className="w-4 h-4 text-purple-600" />
                                      AI Overall Assessment
                                    </h4>
                                    <p className="text-gray-700 text-sm">
                                      {interview.final_results.interview_summary.overall_assessment}
                                    </p>
                                  </div>
                                )}

                                {/* Strengths & Weaknesses */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {interview.final_results.strengths && interview.final_results.strengths.length > 0 && (
                                    <div className="bg-green-50 rounded-lg p-4">
                                      <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Strengths
                                      </h4>
                                      <ul className="space-y-1">
                                        {interview.final_results.strengths.map((strength: string, i: number) => (
                                          <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                                            <span className="text-green-600 mt-1">•</span>
                                            <span>{strength}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {interview.final_results.areas_for_improvement && interview.final_results.areas_for_improvement.length > 0 && (
                                    <div className="bg-orange-50 rounded-lg p-4">
                                      <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Areas for Improvement
                                      </h4>
                                      <ul className="space-y-1">
                                        {interview.final_results.areas_for_improvement.map((area: string, i: number) => (
                                          <li key={i} className="text-sm text-orange-800 flex items-start gap-2">
                                            <span className="text-orange-600 mt-1">•</span>
                                            <span>{area}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Skill Signals */}
                                {interview.final_results.skill_signal_map && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3">Skill Breakdown</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                      {Object.entries(interview.final_results.skill_signal_map).map(([skill, score]: [string, any]) => (
                                        <div key={skill} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                          <span className="text-sm text-gray-700 capitalize">{skill.replace('_', ' ')}</span>
                                          <span className={`text-sm font-bold ${
                                            score >= 7 ? 'text-green-600' : score >= 5 ? 'text-yellow-600' : 'text-red-600'
                                          }`}>
                                            {score}/10
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Question-wise Performance */}
                                {interview.final_results.individual_scores && interview.final_results.individual_scores.length > 0 && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-3">Question Performance</h4>
                                    <div className="space-y-2">
                                      {interview.final_results.individual_scores.map((score: number, i: number) => (
                                        <div key={i} className="flex items-center gap-3">
                                          <span className="text-sm text-gray-600 w-24">Question {i + 1}</span>
                                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                              className={`h-2 rounded-full ${
                                                score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score === 0 ? 'bg-red-500' : 'bg-orange-500'
                                              }`}
                                              style={{ width: `${score}%` }}
                                            />
                                          </div>
                                          <span className={`text-sm font-medium w-12 ${getScoreColor(score)}`}>
                                            {score}%
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Question-by-Question Deep Dive */}
                                {interview.questions_data && Array.isArray(interview.questions_data) && interview.questions_data.length > 0 && (
                                  <div className="bg-white rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                      <MessageSquare className="w-4 h-4 text-blue-600" />
                                      Question-by-Question Analysis
                                    </h4>
                                    <div className="space-y-4">
                                      {interview.questions_data.map((q: any, i: number) => {
                                        // Use question-specific data from database
                                        const score = q.score || 0;
                                        const questionText = q.question_text || q.question || 'Question not available';
                                        const userResponse = q.user_response || '';
                                        const codeSubmission = q.code_submission || '';
                                        const feedback = q.feedback || '';  // Question-specific feedback from LLM
                                        const hintsUsed = q.hints_used || 0;
                                        const language = q.language || 'python';
                                        const timeTaken = q.time_taken || 0;
                                        
                                        return (
                                          <div key={i} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                                            {/* Question Header */}
                                            <div className="flex items-start justify-between mb-3">
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Q{q.question_index || i + 1}</span>
                                                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                                                    q.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                                    q.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                    q.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                                    q.difficulty === 'very hard' ? 'bg-red-200 text-red-800' :
                                                    q.difficulty === 'conversational' ? 'bg-pink-100 text-pink-700' :
                                                    q.difficulty === 'intermediate' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-gray-100 text-gray-700'
                                                  }`}>
                                                    {q.difficulty?.toUpperCase() || 'N/A'}
                                                  </span>
                                                  {interview.type === 'technical' && (
                                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                                                      {language.toUpperCase()}
                                                    </span>
                                                  )}
                                                  {hintsUsed > 0 && (
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                                                      💡 {hintsUsed} hint{hintsUsed > 1 ? 's' : ''}
                                                    </span>
                                                  )}
                                                  {timeTaken > 0 && (
                                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                                                      ⏱️ {Math.floor(timeTaken / 60)}:{(timeTaken % 60).toString().padStart(2, '0')}
                                                    </span>
                                                  )}
                                                  {q.topics && Array.isArray(q.topics) && q.topics.map((topic: string, ti: number) => (
                                                    <span key={ti} className="px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded">
                                                      {topic}
                                                    </span>
                                                  ))}
                                                </div>
                                                <p className="text-sm text-gray-700 mb-2 font-medium">{questionText}</p>
                                              </div>
                                              <div className="ml-4 text-right">
                                                <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                                                  {score}%
                                                </div>
                                                <div className="text-xs text-gray-500">Score</div>
                                              </div>
                                            </div>

                                            {/* Candidate's Response (text/voice) */}
                                            {userResponse && (
                                              <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <MessageSquare className="w-4 h-4 text-blue-600" />
                                                  <span className="text-sm font-semibold text-blue-900">Your Response</span>
                                                </div>
                                                <p className="text-sm text-blue-800">{userResponse}</p>
                                              </div>
                                            )}

                                            {/* Code Submission */}
                                            {codeSubmission && !codeSubmission.includes('# Write your solution here') && (
                                              <div className="mb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <Code2 className="w-4 h-4 text-green-600" />
                                                  <span className="text-sm font-semibold text-gray-900">Your Code Solution ({language})</span>
                                                </div>
                                                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs max-h-64">
                                                  <code>{codeSubmission}</code>
                                                </pre>
                                              </div>
                                            )}

                                            {/* AI Feedback */}
                                            {feedback && (
                                              <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <Brain className="w-4 h-4 text-purple-600" />
                                                  <span className="text-sm font-semibold text-purple-900">AI Feedback</span>
                                                </div>
                                                <p className="text-sm text-purple-800">{feedback}</p>
                                              </div>
                                            )}

                                            {/* Score Bar */}
                                            <div className="flex items-center gap-3">
                                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                                <motion.div
                                                  initial={{ width: 0 }}
                                                  animate={{ width: `${score}%` }}
                                                  transition={{ duration: 0.5, delay: i * 0.1 }}
                                                  className={`h-2 rounded-full ${
                                                    score >= 80 ? 'bg-green-500' : 
                                                    score >= 60 ? 'bg-yellow-500' : 
                                                    score === 0 ? 'bg-red-500' : 'bg-orange-500'
                                                  }`}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced Analytics - Only show if there's data */}
              {profileData.interviews.length > 0 && (
                <>
                  {/* Behavioral Signal Evolution */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Zap className="w-6 h-6 text-purple-600" />
                      <h2 className="text-2xl font-bold text-gray-900">Behavioral Signal Evolution</h2>
                      <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                        CodeSage Unique
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Track how your soft skills evolved across interviews - confidence, ownership, clarity, and recovery abilities
                    </p>
                    <BehavioralSignalEvolutionChart 
                      data={profileData.interviews.map(interview => ({
                        date: interview.date,
                        confidence: interview.final_results?.interview_summary?.coding_confidence === 'high' ? 85 : 
                                   interview.final_results?.interview_summary?.coding_confidence === 'medium' ? 60 : 40,
                        ownership: interview.final_results?.interview_summary?.problem_solving_quality === 'strong' ? 90 : 
                                   interview.final_results?.interview_summary?.problem_solving_quality === 'moderate' ? 65 : 45,
                        hesitation: 100 - (interview.final_results?.technical_signal_breakdown?.hint_dependency === 'low' ? 80 : 
                                           interview.final_results?.technical_signal_breakdown?.hint_dependency === 'medium' ? 50 : 30),
                        recovery: interview.final_results?.technical_signal_breakdown?.debugging_ability === 'strong' ? 85 : 
                                  interview.final_results?.technical_signal_breakdown?.debugging_ability === 'moderate' ? 60 : 40,
                        clarity: interview.score
                      }))}
                    />
                  </div>

                  {/* Process Efficiency & Difficulty Performance Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Process Efficiency Map */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <Clock className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-bold text-gray-900">Process Efficiency</h2>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Time taken, hints used, and retries per question
                      </p>
                      <ProcessEfficiencyChart 
                        data={(() => {
                          const efficiencyData: any[] = [];
                          profileData.interviews.forEach(interview => {
                            if (interview.questions_data && Array.isArray(interview.questions_data)) {
                              interview.questions_data.forEach((q: any, i: number) => {
                                // Use actual database fields from question_responses table
                                efficiencyData.push({
                                  question: `Q${q.question_index || i + 1}`,
                                  timeTaken: q.time_taken || 0,
                                  hintsUsed: q.hints_used || 0,
                                  retries: 0, // Not currently tracked in question_responses
                                  completed: (q.score !== null && q.score !== undefined && q.score > 0)
                                });
                              });
                            }
                          });
                          return efficiencyData.slice(0, 10);
                        })()}
                      />
                    </div>

                    {/* Difficulty vs Performance Scatter */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-bold text-gray-900">Difficulty vs Performance</h2>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        How you perform as complexity increases
                      </p>
                      <DifficultyScatterChart 
                        data={(() => {
                          const scatterData: any[] = [];
                          profileData.interviews.forEach(interview => {
                            if (interview.questions_data && Array.isArray(interview.questions_data)) {
                              interview.questions_data.forEach((q: any, i: number) => {
                                // Use actual database fields from question_responses table
                                const score = q.score !== null && q.score !== undefined ? q.score : 0;
                                const difficultyMap: any = {
                                  'easy': 1,
                                  'medium': 2,
                                  'hard': 3,
                                  'very hard': 4,
                                  'expert': 5
                                };
                                const difficulty = difficultyMap[q.difficulty?.toLowerCase()] || 2;
                                
                                scatterData.push({
                                  difficulty,
                                  score: Math.max(0, score),
                                  question: `Q${q.question_index || i + 1} (${q.difficulty || 'medium'})`
                                });
                              });
                            }
                          });
                          return scatterData.filter(d => d.score >= 0);
                        })()}
                      />
                    </div>
                  </div>

                  {/* Topic Mastery Heatmap */}
                  {profileData.interviews.length >= 3 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <BarChart3 className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-gray-900">Topic-wise Mastery Heatmap</h2>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Performance across different topics over time - identify your strong and weak areas
                      </p>
                      <TopicHeatmap 
                        data={(() => {
                          const topicMap: { [key: string]: { date: string; score: number }[] } = {};
                          const topicNameMap: { [key: string]: string } = {
                            'graphs': 'Graphs',
                            'arrays': 'Arrays',
                            'strings': 'Strings',
                            'trees': 'Trees',
                            'dynamic programming': 'Dynamic Programming',
                            'dp': 'Dynamic Programming',
                            'dsa': 'Data Structures & Algorithms',
                            'data structures': 'Data Structures & Algorithms',
                            'system design': 'System Design',
                            'oops': 'Object-Oriented Programming',
                            'oop': 'Object-Oriented Programming',
                            'machine learning': 'Machine Learning',
                            'ml': 'Machine Learning',
                            'database': 'Database Design',
                            'sql': 'SQL & Databases',
                            'algorithms': 'Algorithms',
                            'sorting': 'Sorting & Searching',
                            'searching': 'Sorting & Searching'
                          };
                          
                          profileData.interviews.forEach(interview => {
                            interview.topics.forEach(topic => {
                              const normalizedTopic = topic.toLowerCase();
                              const displayTopic = topicNameMap[normalizedTopic] || 
                                topic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                              
                              if (!topicMap[displayTopic]) topicMap[displayTopic] = [];
                              topicMap[displayTopic].push({
                                date: interview.date,
                                score: interview.score
                              });
                            });
                          });
                          return Object.entries(topicMap).map(([topic, interviews]) => ({
                            topic,
                            interviews
                          }));
                        })()}
                      />
                    </div>
                  )}

                  {/* Question Outcome Funnel */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Target className="w-6 h-6 text-orange-600" />
                      <h2 className="text-2xl font-bold text-gray-900">Question Completion Funnel</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      Track your progress from initial question through successful completion
                    </p>
                    <QuestionFunnelChart 
                      data={(() => {
                        // Calculate proper funnel data across all interviews
                        let totalQuestions = 0;
                        let attempted = 0;
                        let solved = 0;
                        let solvedWithoutHints = 0;

                        profileData.interviews.forEach(interview => {
                          const questions = interview.questions_data || [];
                          
                          questions.forEach((q: any) => {
                            totalQuestions++;
                            
                            // Attempted: has any user response
                            if (q.user_response && q.user_response.trim() !== '') {
                              attempted++;
                              
                              // Solved: has a positive score
                              const score = parseFloat(q.score) || 0;
                              if (score > 0) {
                                solved++;
                                
                                // Solved without hints: score > 0 and no hints used
                                const hintsUsed = parseInt(q.hints_used) || 0;
                                if (hintsUsed === 0) {
                                  solvedWithoutHints++;
                                }
                              }
                            }
                          });
                        });

                        return {
                          asked: totalQuestions,
                          attempted: attempted,
                          solved: solved,
                          solvedWithoutHints: solvedWithoutHints
                        };
                      })()}
                    />
                  </div>
                </>
              )}

              {/* Comprehensive SWOC/T Analysis */}
              {profileData.swot_analysis && (
                <div className="space-y-6">
                  {/* Header with Current Stage */}
                  <div className="bg-gradient-to-r from-cyan-50 to-violet-50 rounded-xl shadow-md p-6 border border-cyan-100">
                    <div className="flex items-center gap-3 mb-4">
                      <Trophy className="w-7 h-7 text-violet-600" />
                      <h2 className="text-2xl font-bold text-gray-900">Comprehensive Career Analysis</h2>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Target className="w-5 h-5 text-violet-600 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Current Stage</p>
                          <p className="text-lg text-gray-900">{profileData.swot_analysis.current_stage}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-sm font-semibold text-gray-700">Growth Trajectory</p>
                          <p className="text-gray-800">{profileData.swot_analysis.longitudinal_growth}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Readiness Scores */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Code2 className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-bold text-gray-900">Technical Readiness</h3>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-blue-600">
                          {profileData.swot_analysis.technical_readiness.score}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{profileData.swot_analysis.technical_readiness.justification}</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <MessageSquare className="w-6 h-6 text-purple-600" />
                        <h3 className="text-lg font-bold text-gray-900">Behavioral Readiness</h3>
                      </div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-3xl font-bold text-purple-600">
                          {profileData.swot_analysis.behavioral_readiness.score}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{profileData.swot_analysis.behavioral_readiness.justification}</p>
                    </div>
                  </div>

                  {/* SWOC/T Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Strengths */}
                    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
                      <div className="flex items-center gap-3 mb-4">
                        <Star className="w-6 h-6 text-green-600" />
                        <h3 className="text-xl font-bold text-gray-900">Strengths</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {profileData.swot_analysis.strengths.map((strength, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-1" />
                            <span className="text-sm text-gray-700">{strength}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* Weaknesses */}
                    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
                      <div className="flex items-center gap-3 mb-4">
                        <AlertCircle className="w-6 h-6 text-orange-600" />
                        <h3 className="text-xl font-bold text-gray-900">Areas for Improvement</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {profileData.swot_analysis.weaknesses.map((weakness, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2"
                          >
                            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-1" />
                            <span className="text-sm text-gray-700">{weakness}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* Opportunities */}
                    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                      <div className="flex items-center gap-3 mb-4">
                        <Zap className="w-6 h-6 text-blue-600" />
                        <h3 className="text-xl font-bold text-gray-900">Growth Opportunities</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {profileData.swot_analysis.opportunities.map((opportunity, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2"
                          >
                            <Zap className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                            <span className="text-sm text-gray-700">{opportunity}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    {/* Threats/Challenges */}
                    <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
                      <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-6 h-6 text-red-600" />
                        <h3 className="text-xl font-bold text-gray-900">Challenges to Address</h3>
                      </div>
                      <ul className="space-y-2.5">
                        {profileData.swot_analysis.threats.map((threat, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-start gap-2"
                          >
                            <Shield className="w-4 h-4 text-red-600 flex-shrink-0 mt-1" />
                            <span className="text-sm text-gray-700">{threat}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Detailed Breakdown */}
                  <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <BarChart3 className="w-6 h-6 text-violet-600" />
                      <h3 className="text-xl font-bold text-gray-900">Competency Breakdown</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(profileData.swot_analysis.detailed_breakdown).map(([key, value]) => (
                        <div key={key} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-700 capitalize">
                              {key.replace('_', ' ')}
                            </h4>
                            <span className={`text-lg font-bold ${
                              value.score >= 75 ? 'text-green-600' : 
                              value.score >= 60 ? 'text-blue-600' : 
                              value.score >= 40 ? 'text-orange-600' : 'text-red-600'
                            }`}>
                              {value.score}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                              className={`h-2 rounded-full ${
                                value.score >= 75 ? 'bg-green-600' : 
                                value.score >= 60 ? 'bg-blue-600' : 
                                value.score >= 40 ? 'bg-orange-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${value.score}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">{value.assessment}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Recommendations */}
                  <div className="bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl shadow-md p-6 border border-violet-100">
                    <div className="flex items-center gap-3 mb-4">
                      <Brain className="w-6 h-6 text-violet-600" />
                      <h3 className="text-xl font-bold text-gray-900">Prioritized Recommendations</h3>
                    </div>
                    <ol className="space-y-3">
                      {profileData.swot_analysis.key_recommendations.map((rec, idx) => (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-start gap-3"
                        >
                          <span className="flex-shrink-0 w-7 h-7 bg-violet-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-gray-800 pt-1">{rec}</span>
                        </motion.li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* Fallback: Simple Strengths & Improvements (if SWOC/T not available) */}
              {!profileData.swot_analysis && (profileData.strengths.length > 0 || profileData.improvements.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Strengths */}
                  {profileData.strengths.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Star className="w-6 h-6 text-yellow-500" />
                        <h2 className="text-xl font-bold text-gray-900">Key Strengths</h2>
                      </div>
                      <ul className="space-y-3">
                        {profileData.strengths.map((strength, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-start gap-2"
                          >
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{strength}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {profileData.improvements.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Target className="w-6 h-6 text-orange-500" />
                        <h2 className="text-xl font-bold text-gray-900">Growth Areas</h2>
                      </div>
                      <ul className="space-y-3">
                        {profileData.improvements.map((improvement, idx) => (
                          <motion.li
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-start gap-2"
                          >
                            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{improvement}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Empty State */}
              {profileData.stats.total_interviews === 0 && (
                <div className="bg-white rounded-xl shadow-md p-12 text-center">
                  <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No Interviews Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Complete your first interview to start building your profile and showcase your skills.
                  </p>
                  <a
                    href="/interview"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white rounded-lg hover:shadow-lg transition"
                  >
                    Take Your First Interview
                  </a>
                </div>
              )}
            </motion.div>
          ) : (
            /* Public View */
            <motion.div
              key="public"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Public Info Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Unlock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Public View Mode</h3>
                  <p className="text-sm text-blue-700">
                    This is what recruiters and hiring managers see when you share your profile.
                    Sensitive details like individual questions, detailed feedback, and internal metrics are hidden.
                  </p>
                </div>
              </div>

              {/* Public Skills Overview */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Skills Overview</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <SkillRadarChart skills={profileData.skills} />
                  <div className="space-y-4">
                    {Object.entries(profileData.skills).map(([skill, value]) => (
                      <div key={skill}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">
                            {skill.replace('_', ' ')}
                          </span>
                          <span className={`font-bold ${getScoreColor(value)}`}>{value}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            style={{ width: `${value}%` }}
                            className={`h-2 rounded-full ${
                              value >= 80 ? 'bg-green-500' :
                              value >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Performance Summary */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                    <h3 className="text-3xl font-bold text-gray-900">{profileData.stats.total_interviews}</h3>
                    <p className="text-gray-600 text-sm">Total Interviews</p>
                  </div>
                  <div>
                    <Target className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                    <h3 className="text-3xl font-bold text-gray-900">{profileData.stats.average_score}%</h3>
                    <p className="text-gray-600 text-sm">Average Score</p>
                  </div>
                  <div>
                    <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-2" />
                    <h3 className="text-2xl font-bold text-green-900 capitalize">{profileData.performance.trend}</h3>
                    <p className="text-gray-600 text-sm">Performance Trend</p>
                  </div>
                </div>
              </div>

              {/* Key Strengths (Public) */}
              {profileData.strengths.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Strengths</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profileData.strengths.map((strength, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-4 bg-green-50 rounded-lg"
                      >
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{strength}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verification Footer */}
              <div className="bg-gradient-to-r from-cyan-600 to-violet-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">AI-Evaluated & Verified</h3>
                    <p className="text-cyan-100 text-sm">
                      This profile is backed by real interview sessions with comprehensive AI analysis.
                      All scores and evaluations are auditable and session-based.
                    </p>
                  </div>
                  <Shield className="w-16 h-16 text-white opacity-50" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shareable Link Section */}
        {viewMode === 'private' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-white rounded-xl shadow-md p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <Share2 className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Share Your Profile</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Share this link with recruiters and hiring managers. They'll see only your public profile view.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={shareableLink}
                readOnly
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
              <button
                onClick={copyShareableLink}
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-violet-600 text-white rounded-lg hover:shadow-lg transition flex items-center gap-2"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function ProfilePageWrapper() {
  return (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  );
}
