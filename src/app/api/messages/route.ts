import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const { chatRoomId, content, fileUrl, fileName, fileSize } = body;

		// Validate required fields
		if (!chatRoomId || !content) {
			return NextResponse.json(
				{ error: "Missing required fields: chatRoomId, content" },
				{ status: 400 }
			);
		}

		// Make request to backend API
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				chatRoomId,
				content,
				fileUrl,
				fileName,
				fileSize,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to send message" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error sending message:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
