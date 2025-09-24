import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const { name, type, loadId, participantIds } = body;

		// Validate required fields
		if (!name || !type || !loadId || !participantIds || !Array.isArray(participantIds)) {
			return NextResponse.json(
				{ error: "Missing required fields: name, type, loadId, participantIds" },
				{ status: 400 }
			);
		}

		// Validate type
		if (!["DIRECT", "GROUP"].includes(type)) {
			return NextResponse.json(
				{ error: "Invalid type. Must be 'DIRECT' or 'GROUP'" },
				{ status: 400 }
			);
		}

		// Validate participantIds array
		if (participantIds.length === 0) {
			return NextResponse.json(
				{ error: "At least one participant is required" },
				{ status: 400 }
			);
		}

		// Make request to backend API
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				name,
				type,
				loadId,
				participantIds,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to create chat room" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during chat room creation:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
