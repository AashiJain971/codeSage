import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    console.log('🔧 Stats API DEBUG - API_URL:', API_URL);
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL not set for stats!');
      return NextResponse.json({ total: 0, approved: 0, rejected: 0, manually_ended: 0, timeout: 0, average_score: 0, average_duration: 0, total_questions_answered: 0, completion_rate: 0 }, { status: 200 });
    }
    const response = await fetch(`${API_URL}/api/interviews/stats`, {
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
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { 
        total: 0,
        approved: 0,
        rejected: 0,
        manually_ended: 0,
        timeout: 0,
        average_score: 0,
        average_duration: 0,
        total_questions_answered: 0,
        completion_rate: 0
      },
      { status: 200 }
    );
  }
}
