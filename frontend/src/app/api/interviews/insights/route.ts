import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/interviews/analytics/insights', {
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
    console.error('Error fetching insights:', error);
    return NextResponse.json(
      {
        strengths: [],
        areas_for_improvement: [],
        recommendations: []
      },
      { status: 200 }
    );
  }
}
