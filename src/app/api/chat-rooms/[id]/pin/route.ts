import { NextRequest, NextResponse } from 'next/server';
import { serverAuth } from '@/utils/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id: chatRoomId } = await params;

		// Get auth token from cookies
		const token = serverAuth.getAccessToken(request);
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Forward request to backend
		const backendResponse = await fetch(`${BACKEND_URL}/v1/chat-rooms/${chatRoomId}/pin`, {
			method: 'PUT',
			headers: {
				'Authorization': `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
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
		console.error('Error in pin chat room API route:', error);
		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
