import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL;
    console.log('🔧 Insights API DEBUG - API_URL:', API_URL);
    if (!API_URL) {
      console.error('❌ NEXT_PUBLIC_API_URL not set for insights!');
      return NextResponse.json({ strengths: [], areas_for_improvement: [], recommendations: [] }, { status: 200 });
    }
    const response = await fetch(`${API_URL}/api/interviews/analytics/insights`, {
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
