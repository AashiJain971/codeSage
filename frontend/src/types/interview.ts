export interface Interview {
  id: string;
  type: 'technical' | 'resume';
  date: string;
  duration: number;
  duration_seconds?: number;
  score: number;
  status: 'approved' | 'rejected' | 'manually_ended' | 'timeout' | 'in_progress';
  topics?: string[];
  questions_completed: number;
  total_questions: number;
  interviewer: string;
  feedback: string;
  completion_method?: string;
  individual_scores?: number[];
  start_time?: string;
  end_time?: string;
  final_results?: any;
}

export interface QuestionResponse {
  index: number;
  question_text: string;
  user_response?: string;
  code_submission?: string;
  score?: number;
  feedback?: string;
  time_taken?: number;
  hints_used?: number;
  difficulty?: string;
  created_at?: string;
}

export interface InterviewDetail extends Interview {
  questions?: QuestionResponse[];
}

export interface StatsOverview {
  total: number;
  approved: number;
  rejected: number;
  manually_ended: number;
  timeout: number;
  average_score: number;
  average_duration: number;
  total_questions_answered: number;
  completion_rate: number;
}

export interface TopicPerformance {
  topic: string;
  average_score: number;
  attempts: number;
  max_score: number;
  min_score: number;
}

export interface PerformanceAnalytics {
  topic_performance: TopicPerformance[];
  score_distribution: {
    '0-20': number;
    '21-40': number;
    '41-60': number;
    '61-80': number;
    '81-100': number;
  };
  time_efficiency: {
    average: number;
    by_interview: Record<string, number>;
  };
  improvement_trend: Array<{
    date: string;
    score: number;
    interview_number: number;
  }>;
  consistency_score: number;
}

export interface PerformanceInsights {
  strengths: Array<{
    topic: string;
    average_score: number;
    description: string;
  }>;
  areas_for_improvement: Array<{
    topic: string;
    average_score: number;
    description: string;
  }>;
  recommendations: Array<{
    category: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}
