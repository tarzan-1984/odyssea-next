import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function PUT(request: NextRequest) {
	try {
		const token = serverAuth.getAccessToken(request);
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { chatRoomIds, action } = body;

		if (!chatRoomIds || !Array.isArray(chatRoomIds)) {
			return NextResponse.json(
				{ error: 'chatRoomIds is required and must be an array' },
				{ status: 400 }
			);
		}

		if (!action || !['mute', 'unmute'].includes(action)) {
			return NextResponse.json(
				{ error: 'action is required and must be either "mute" or "unmute"' },
				{ status: 400 }
			);
		}

		const backendResponse = await fetch(`${BACKEND_URL}/v1/chat-rooms/mute`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ chatRoomIds, action }),
		});

		if (!backendResponse.ok) {
			const errorData = await backendResponse.text();
			return NextResponse.json(
				{ error: 'Backend request failed', details: errorData },
				{ status: backendResponse.status }
			);
		}

		const data = await backendResponse.json();
		return NextResponse.json(data);

	} catch (error) {
		console.error('Error in mute chat rooms API route:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
