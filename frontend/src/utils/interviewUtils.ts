'use client';

import { Interview } from '../types/interview';

export interface FilterOptions {
  status: 'all' | 'approved' | 'rejected' | 'manually_ended' | 'timeout';
  interviewType: 'all' | 'technical' | 'resume';
  scoreRange: { min: number; max: number };
  dateRange: { start: Date | null; end: Date | null };
  topics: string[];
  searchQuery: string;
}

export const defaultFilters: FilterOptions = {
  status: 'all',
  interviewType: 'all',
  scoreRange: { min: 0, max: 100 },
  dateRange: { start: null, end: null },
  topics: [],
  searchQuery: ''
};

export function filterInterviews(
  interviews: Interview[],
  filters: FilterOptions
): Interview[] {
  return interviews.filter(interview => {
    // Status filter
    if (filters.status !== 'all' && interview.status !== filters.status) {
      return false;
    }

    // Interview type filter
    if (filters.interviewType !== 'all' && interview.type !== filters.interviewType) {
      return false;
    }

    // Score range filter
    if (interview.score < filters.scoreRange.min || interview.score > filters.scoreRange.max) {
      return false;
    }

    // Date range filter
    if (filters.dateRange.start || filters.dateRange.end) {
      const interviewDate = new Date(interview.date);
      // Skip if date is invalid
      if (isNaN(interviewDate.getTime())) {
        return false;
      }
      if (filters.dateRange.start && interviewDate < filters.dateRange.start) {
        return false;
      }
      if (filters.dateRange.end && interviewDate > filters.dateRange.end) {
        return false;
      }
    }

    // Topics filter
    if (filters.topics.length > 0) {
      const hasMatchingTopic = interview.topics?.some(topic => 
        filters.topics.includes(topic)
      );
      if (!hasMatchingTopic) {
        return false;
      }
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesId = interview.id.toLowerCase().includes(query);
      const matchesInterviewer = interview.interviewer?.toLowerCase().includes(query);
      const matchesFeedback = interview.feedback?.toLowerCase().includes(query);
      const matchesTopics = interview.topics?.some(topic => 
        topic.toLowerCase().includes(query)
      );
      
      if (!matchesId && !matchesInterviewer && !matchesFeedback && !matchesTopics) {
        return false;
      }
    }

    return true;
  });
}

export function sortInterviews(
  interviews: Interview[],
  sortBy: 'date' | 'score' | 'duration' | 'questions',
  order: 'asc' | 'desc' = 'desc'
): Interview[] {
  const sorted = [...interviews].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case 'date':
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        // Handle invalid dates by putting them at the end
        if (isNaN(dateA) && isNaN(dateB)) compareValue = 0;
        else if (isNaN(dateA)) compareValue = 1;
        else if (isNaN(dateB)) compareValue = -1;
        else compareValue = dateB - dateA;
        break;
      case 'score':
        compareValue = b.score - a.score;
        break;
      case 'duration':
        compareValue = b.duration - a.duration;
        break;
      case 'questions':
        compareValue = b.questions_completed - a.questions_completed;
        break;
      default:
        compareValue = 0;
    }

    return order === 'desc' ? compareValue : -compareValue;
  });

  return sorted;
}

export function getAllTopics(interviews: Interview[]): string[] {
  const topicsSet = new Set<string>();
  interviews.forEach(interview => {
    interview.topics?.forEach(topic => topicsSet.add(topic));
  });
  return Array.from(topicsSet).sort();
}

export function calculateStats(interviews: Interview[]) {
  if (interviews.length === 0) {
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      manually_ended: 0,
      timeout: 0,
      averageScore: 0,
      averageDuration: 0,
      totalQuestions: 0,
      completionRate: 0
    };
  }

  const total = interviews.length;
  const approved = interviews.filter(i => i.status === 'approved').length;
  const rejected = interviews.filter(i => i.status === 'rejected').length;
  const manually_ended = interviews.filter(i => i.status === 'manually_ended').length;
  const timeout = interviews.filter(i => i.status === 'timeout').length;

  const scores = interviews.filter(i => i.score > 0).map(i => i.score);
  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) 
    : 0;

  const durations = interviews.filter(i => i.duration > 0).map(i => i.duration);
  const averageDuration = durations.length > 0
    ? Math.round(durations.reduce((sum, dur) => sum + dur, 0) / durations.length)
    : 0;

  const totalQuestions = interviews.reduce((sum, i) => sum + i.questions_completed, 0);
  const expectedQuestions = interviews.reduce((sum, i) => sum + i.total_questions, 0);
  const completionRate = expectedQuestions > 0 
    ? Math.round((totalQuestions / expectedQuestions) * 100) 
    : 0;

  return {
    total,
    approved,
    rejected,
    manually_ended,
    timeout,
    averageScore,
    averageDuration,
    totalQuestions,
    completionRate
  };
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return '0m';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds}s`;
  } else if (remainingSeconds === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${remainingSeconds}s`;
  }
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid Date';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-100';
    case 'rejected':
      return 'text-red-600 bg-red-100';
    case 'manually_ended':
      return 'text-orange-600 bg-orange-100';
    case 'timeout':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}
