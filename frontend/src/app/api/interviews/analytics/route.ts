import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    console.log('🔧 Analytics API DEBUG - API_URL:', API_URL);
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL not set for analytics!');
      return NextResponse.json({ topic_performance: [], score_distribution: { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 }, time_efficiency: { average: 0, by_interview: {} }, improvement_trend: [], consistency_score: 0 }, { status: 200 });
    }
    const response = await fetch(`${API_URL}/api/interviews/analytics/performance`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      {
        topic_performance: [],
        score_distribution: {
          '0-20': 0,
          '21-40': 0,
          '41-60': 0,
          '61-80': 0,
          '81-100': 0
        },
        time_efficiency: { average: 0, by_interview: {} },
        improvement_trend: [],
        consistency_score: 0
      },
      { status: 200 }
    );
  }
}
