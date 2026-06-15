import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/chat-rooms/by-load/[loadId] — LOAD chat by TMS load id (active or archived)
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { loadId } = await params;
		const trimmed = loadId?.trim();
		if (!trimmed) {
			return NextResponse.json({ error: "loadId is required" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms/by-load/${encodeURIComponent(trimmed)}`,
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
				{ error: data.message || "Failed to fetch LOAD chat" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching LOAD chat by loadId:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
