import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/messages/chat-room/[id]/files - Get files for a specific chat room with pagination
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		const { searchParams } = new URL(request.url);
		const page = searchParams.get("page") || "1";
		const limit = searchParams.get("limit") || "10";

		// Make request to backend API for files only
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/chat-room/${id}/files?page=${page}&limit=${limit}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to fetch files" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching files:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
