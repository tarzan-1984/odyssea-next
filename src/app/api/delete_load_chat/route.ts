import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { load_id } = body;

    if (!load_id) {
      return NextResponse.json(
        { error: 'load_id is required' },
        { status: 400 }
      );
    }

    const accessToken = serverAuth.getAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Forward request to backend
    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/delete_load_chat`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ load_id }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { error: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error deleting LOAD chat:', error);
    return NextResponse.json(
      { error: 'Failed to delete LOAD chat' },
      { status: 500 }
    );
  }
}
