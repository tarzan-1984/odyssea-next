import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    // Get access token from server-side authentication
    const accessToken = serverAuth.getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Proxy request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${backendUrl}/v1/notifications/unread-count`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Backend already returns wrapped response, so return it directly
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
