import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// PATCH /api/chat-rooms/[id]/read - Mark chat room as read
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;

		// Make request to backend API
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms/${id}/read`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return NextResponse.json(
				{ error: errorData.message || "Failed to mark chat room as read" },
				{ status: response.status }
			);
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error("Error marking chat room as read:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
