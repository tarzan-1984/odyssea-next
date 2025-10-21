import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatRoomId: string; year: string; month: string; day: string }> }
) {
  try {
    const { chatRoomId, year, month, day } = await params;

    if (!chatRoomId || !year || !month || !day) {
      return NextResponse.json(
        { success: false, error: 'Chat room ID, year, month, and day are required' },
        { status: 400 }
      );
    }

    // Validate year, month, and day
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum) ||
        monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return NextResponse.json(
        { success: false, error: 'Invalid year, month, or day' },
        { status: 400 }
      );
    }

    // Get access token from server-side authentication
    const accessToken = serverAuth.getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Proxy request to backend
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/archive/chat-rooms/${chatRoomId}/${year}/${month}/${day}`,
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
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error loading archived messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
