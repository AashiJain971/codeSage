'use client';

import { motion } from 'framer-motion';
import { 
  Award, TrendingUp, Trophy, CheckCircle, Shield, 
  ExternalLink, ArrowLeft, Clock, Code2, Zap
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
import ProcessEfficiencyChart from '@/components/charts/ProcessEfficiencyChart';
import LanguageDistributionChart from '@/components/charts/LanguageDistributionChart';

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
    recent_scores: number[];
    dates: string[];
  };
  interviews: any[];
  language_distribution: Record<string, number>;
  process_efficiency: {
    avg_time_per_question: number;
    completion_rate: number;
    total_attempted: number;
    total_expected: number;
  };
  recommendations: Array<{
    category: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
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
            <div className="overflow-hidden">
              <SkillRadarChart skills={profileData.skills} />
            </div>
            <div className="overflow-hidden">
              <SkillDistributionChart skills={profileData.skills} />
            </div>
          </div>
        </motion.div>

        {/* Performance Analytics - Comprehensive View */}
        {profileData.performance.recent_scores && profileData.performance.recent_scores.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Performance Trend */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white rounded-xl shadow-md p-6 overflow-hidden"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Trend</h2>
              <div className="overflow-hidden">
                <PerformanceTrendChart 
                  scores={profileData.performance.recent_scores}
                  dates={profileData.performance.dates || []}
                />
              </div>
            </motion.div>

            {/* Languages Used */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl shadow-md p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Code2 className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-gray-900">Languages Used</h2>
              </div>
              <LanguageDistributionChart interviews={profileData.interviews} />
            </motion.div>
          </div>
        )}

        {/* Additional Analytics - Behavioral & Difficulty */}
        {profileData.interviews && profileData.interviews.length >= 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Behavioral Signal Evolution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="bg-white rounded-xl shadow-md p-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">Behavioral Signal Evolution</h2>
                <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-medium">
                  CodeSage Unique
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Track how your soft skills evolved across interviews - confidence, ownership, clarity, and recovery abilities
              </p>
              <div className="overflow-hidden">
                <BehavioralSignalEvolutionChart 
                  data={profileData.interviews.map((interview: any) => ({
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
            </motion.div>

            {/* Difficulty vs Performance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-xl shadow-md p-6 overflow-hidden"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Difficulty vs Performance</h2>
              <div className="overflow-hidden">
                <DifficultyScatterChart 
                  data={(() => {
                    const scatterData: any[] = [];
                    profileData.interviews.forEach((interview: any) => {
                      if (interview.questions_data && Array.isArray(interview.questions_data)) {
                        interview.questions_data.forEach((q: any, i: number) => {
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
            </motion.div>
          </div>
        )}

        {/* Process Efficiency & Difficulty Performance Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Process Efficiency Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-white rounded-xl shadow-md p-6"
          >
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
          </motion.div>

          {/* Difficulty vs Performance Scatter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-md p-6 overflow-hidden"
          >
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold text-gray-900">Difficulty vs Performance</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              How you perform as complexity increases
            </p>
            <div className="overflow-hidden">
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
          </motion.div>
        </div>

        {/* Competency Breakdown & Prioritized Recommendations */}
        {profileData.swot_analysis && profileData.swot_analysis.detailed_breakdown && (
          <div className="grid grid-cols-1 gap-6 mb-8">
            {/* Competency Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-white rounded-xl shadow-md p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-5">Competency Breakdown</h2>
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
            </motion.div>

            {/* Prioritized Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-r from-violet-50 to-cyan-50 rounded-xl shadow-md p-6 border border-violet-100"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Prioritized Recommendations</h2>
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
            </motion.div>
          </div>
        )}

        {/* Fallback: Basic Skills & Recommendations (if SWOT not available) */}
        {!profileData.swot_analysis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Competency Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-white rounded-xl shadow-md p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Competency Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(profileData.skills)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([skill, score]) => (
                    <div key={skill} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {skill.replace('_', ' ')}
                          </span>
                          <span className={`text-sm font-bold ${
                            (score as number) >= 80 ? 'text-green-600' : 
                            (score as number) >= 60 ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {(score as number).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              (score as number) >= 80 ? 'bg-green-500' : 
                              (score as number) >= 60 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>

            {/* Prioritized Recommendations */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-xl shadow-md p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4">Prioritized Recommendations</h2>
              <div className="space-y-3">
                {profileData.recommendations && profileData.recommendations.length > 0 ? (
                  profileData.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-l-4 ${
                        rec.priority === 'high' 
                          ? 'bg-red-50 border-red-500' 
                          : rec.priority === 'medium' 
                          ? 'bg-yellow-50 border-yellow-500' 
                          : 'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold uppercase ${
                              rec.priority === 'high' 
                                ? 'text-red-700' 
                                : rec.priority === 'medium' 
                                ? 'text-yellow-700' 
                                : 'text-blue-700'
                            }`}>
                              {rec.priority}
                            </span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs font-medium text-gray-600">{rec.category}</span>
                          </div>
                          <p className="text-sm text-gray-800">{rec.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">Continue practicing to unlock personalized recommendations</p>
                )}
              </div>
            </motion.div>
          </div>
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
