import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/chat-rooms/load-archived — paginated LOAD chats with is_load_archived=true
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const q = searchParams.toString();

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms/load-archived${q ? `?${q}` : ""}`,
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
				{ error: data.message || "Failed to fetch archived load chats" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching archived load chats:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
