import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    console.log('🔔 Next.js API: Fetching notifications...');
    
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '8';

    console.log('🔔 Next.js API: Requesting page:', page, 'limit:', limit);

    // Get access token from server-side authentication
    const accessToken = serverAuth.getAccessToken(request);
    if (!accessToken) {
      console.log('🔔 Next.js API: No access token found');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Proxy request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(
      `${backendUrl}/v1/notifications?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('🔔 Next.js API: Backend response status:', response.status);

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log('🔔 Next.js API: Backend response data:', data);
    
    // Backend already returns wrapped response, so return it directly
    return NextResponse.json(data);
  } catch (error) {
    console.error('🔔 Next.js API: Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

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
      `${backendUrl}/v1/notifications/mark-all-read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Backend already returns wrapped response, so return it directly
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
