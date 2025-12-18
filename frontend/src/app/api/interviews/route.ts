import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // Build URL with query parameters
    const backendUrl = queryString 
      ? `http://127.0.0.1:8000/api/interviews?${queryString}`
      : 'http://127.0.0.1:8000/api/interviews';
    
    // Make a request to the Python backend
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Increased timeout for large datasets
      signal: AbortSignal.timeout(30000), // 30 second timeout
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