import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Make a request to the Python backend
    const response = await fetch('http://127.0.0.1:8000/api/interviews', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    
    // Return empty data instead of error to prevent frontend crashes
    return NextResponse.json(
      { 
        interviews: [], 
        total: 0, 
        message: 'Backend service unavailable. Please ensure the backend server is running.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 200 } // Return 200 so frontend doesn't show error state
    );
  }
}