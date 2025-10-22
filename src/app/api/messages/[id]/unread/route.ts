import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: messageId } = await params;

		if (!messageId) {
			return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
		}

		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		// Forward request to backend
		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/${messageId}/unread`;

		const response = await fetch(backendUrl, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			const errorData = await response.text();
			return NextResponse.json({ error: errorData }, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error marking message as unread:", error);
		return NextResponse.json({ error: "Failed to mark message as unread" }, { status: 500 });
	}
}
