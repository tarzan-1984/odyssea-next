import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatRoomId: string }> }
) {
  try {
    const { chatRoomId } = await params;

    if (!chatRoomId) {
      return NextResponse.json(
        { success: false, error: 'Chat room ID is required' },
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
      `${process.env.NEXT_PUBLIC_API_URL}/v1/messages/archive/chat-rooms/${chatRoomId}/days`,
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

    console.log('🔍 [NEXT API] Backend response:', data);

    // Backend already returns wrapped response, so return it directly
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching available archive days:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
