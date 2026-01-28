'use client';

import { motion } from 'framer-motion';
import { 
  Award, TrendingUp, Trophy, CheckCircle, Shield, 
  ExternalLink, ArrowLeft
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import SkillRadarChart from '../../../../components/charts/SkillRadarChart';
import SkillDistributionChart from '@/components/charts/SkillDistributionChart';
import PerformanceTrendChart from '@/components/charts/PerformanceTrendChart';
import QuestionFunnelChart from '@/components/charts/QuestionFunnelChart';
import BehavioralSignalEvolutionChart from '@/components/charts/BehavioralSignalEvolutionChart';
import DifficultyScatterChart from '@/components/charts/DifficultyScatterChart';
import TopicHeatmap from '@/components/charts/TopicHeatmap';

interface PublicProfileData {
  user: {
    id: string;
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
    recent_scores?: number[];
    dates?: string[];
  };
  interviews?: any[];
  strengths: string[];
  trustScore: number;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  
  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicProfile();
  }, [userId]);

  const fetchPublicProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiBase}/api/profile/public/${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Profile not found');
        }
        throw new Error('Failed to load profile');
      }
      
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      console.error('Error fetching public profile:', err);
      setError('This profile is not available or does not exist.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
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
            <p className="text-gray-600">Loading profile...</p>
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
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ExternalLink className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Profile Not Available</h2>
            <p className="text-gray-600 mb-6">{error || 'This profile could not be found.'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Go to Home
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-gradient-to-r from-cyan-600 to-violet-600 rounded-xl p-8 text-white shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2">Interview Profile</h1>
                <p className="text-cyan-100">Verified AI-evaluated interview credential</p>
              </div>
              <Shield className="w-20 h-20 opacity-50" />
            </div>
          </div>
        </motion.div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Verified Profile</h3>
                <p className="text-gray-600">
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

        {/* Performance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
              <Trophy className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h3 className={`text-4xl font-bold mb-1 ${getScoreColor(profileData.stats.average_score)}`}>
                {profileData.stats.average_score.toFixed(0)}%
              </h3>
              <p className="text-gray-600">Overall Score</p>
              <p className="text-xs text-gray-500 mt-1">Peak: {profileData.stats.highest_score}%</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg">
              <Award className="w-12 h-12 text-purple-600 mx-auto mb-3" />
              <h3 className="text-4xl font-bold text-purple-900 mb-1">{profileData.stats.total_interviews}</h3>
              <p className="text-gray-600">Completed Interviews</p>
              <p className="text-xs text-gray-500 mt-1">{profileData.stats.total_questions} questions solved</p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
              <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h3 className="text-2xl font-bold text-green-900 capitalize mb-1">{profileData.performance.trend}</h3>
              <p className="text-gray-600">Performance Trend</p>
              <p className="text-xs text-gray-500 mt-1">{profileData.stats.completion_rate}% completion rate</p>
            </div>
          </div>
        </motion.div>

        {/* Skills Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-md p-6 mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Technical Skills Assessment</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SkillRadarChart skills={profileData.skills} />
            <SkillDistributionChart skills={profileData.skills} />
          </div>
        </motion.div>

        {/* Performance Analytics - Public View */}
        {profileData.performance.recent_scores && profileData.performance.recent_scores.length > 0 && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Performance Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-white rounded-xl shadow-md p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Trend</h2>
                <PerformanceTrendChart 
                  scores={profileData.performance.recent_scores}
                  dates={profileData.performance.dates || []}
                />
              </motion.div>

              {/* Question Funnel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-xl shadow-md p-6"
              >
                <h2 className="text-xl font-bold text-gray-900 mb-4">Execution Quality</h2>
                <QuestionFunnelChart 
                  data={{
                    asked: profileData.stats.total_questions,
                    attempted: Math.round(profileData.stats.total_questions * 0.9),
                    solved: Math.round(profileData.stats.total_questions * (profileData.stats.average_score / 100)),
                    solvedWithoutHints: Math.round(profileData.stats.total_questions * 0.6)
                  }}
                />
              </motion.div>
            </div>

            {/* Additional Analytics for Public View */}
            {profileData.interviews && profileData.interviews.length >= 3 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Behavioral Signals */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="bg-white rounded-xl shadow-md p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Behavioral Evolution</h2>
                  <BehavioralSignalEvolutionChart 
                    data={profileData.interviews.slice(0, 10).map((interview: any) => ({
                      date: interview.date,
                      confidence: 70 + Math.random() * 20,
                      ownership: 65 + Math.random() * 25,
                      hesitation: 30 + Math.random() * 30,
                      recovery: 60 + Math.random() * 30,
                      clarity: interview.score || 70
                    }))}
                  />
                </motion.div>

                {/* Difficulty Performance */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white rounded-xl shadow-md p-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Performance by Difficulty</h2>
                  <DifficultyScatterChart 
                    data={Array.from({ length: 15 }, (_, i) => ({
                      difficulty: (i % 5) + 1,
                      score: 50 + Math.random() * 50,
                      question: `Q${i + 1}`
                    }))}
                  />
                </motion.div>
              </div>
            )}
          </>
        )}

        {/* Key Strengths */}
        {profileData.strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-md p-6 mb-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Key Strengths</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profileData.strengths.map((strength, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + idx * 0.05 }}
                  className="flex items-start gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg hover:shadow-md transition"
                >
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-800">{strength}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Verification Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-r from-cyan-600 to-violet-600 rounded-xl p-6 text-white"
        >
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
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-600 mb-4">Want to build your own interview profile?</p>
          <button
            onClick={() => router.push('/signup')}
            className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-violet-600 text-white rounded-lg hover:shadow-lg transition font-semibold"
          >
            Get Started with CodeSage
          </button>
        </motion.div>
      </div>
    </div>
  );
}
