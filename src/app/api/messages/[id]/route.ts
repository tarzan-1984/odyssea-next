import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
	try {
		const messageId = params.id;

		if (!messageId) {
			return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
		}

		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		// Forward request to backend
		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/${messageId}`;

		const response = await fetch(backendUrl, {
			method: "DELETE",
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
		console.error("Error deleting message:", error);
		return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
	}
}
