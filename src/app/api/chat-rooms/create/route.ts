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
		
		console.log('API route body=================', body);
		console.log('API route name=================', name);
		console.log('API route loadId=================', loadId);

		// Validate required fields (loadId is optional)
		if (!name || !type || !participantIds || !Array.isArray(participantIds)) {
			return NextResponse.json(
				{ error: "Missing required fields: name, type, participantIds" },
				{ status: 400 }
			);
		}

		// Ensure name is a string and not undefined
		if (typeof name !== 'string' || name.trim() === '') {
			return NextResponse.json(
				{ error: "Name must be a non-empty string" },
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

		// Additional validation for specific chat types
		if (type === "DIRECT" && participantIds.length !== 2) {
			return NextResponse.json(
				{ error: "Direct chats must have exactly 2 participants" },
				{ status: 400 }
			);
		}

		if (type === "GROUP" && participantIds.length < 2) {
			return NextResponse.json(
				{ error: "Group chats must have at least 2 participants" },
				{ status: 400 }
			);
		}

		// Build payload conditionally including optional loadId
		const payload: Record<string, unknown> = {
			name,
			type,
			participantIds,
		};
		if (loadId && typeof loadId === 'string' && loadId.trim() !== '') {
			payload.loadId = loadId;
		}

		// Make request to backend API
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
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
