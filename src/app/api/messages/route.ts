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
		const { chatRoomId, content, fileUrl, fileName, fileSize, attachments, replyData } = body;

		const text = typeof content === "string" ? content.trim() : "";
		const hasFile = Boolean(fileUrl);
		const hasMulti =
			Array.isArray(attachments) && attachments.length > 0;

		// Validate required fields
		if (!chatRoomId || (!text && !hasFile && !hasMulti)) {
			return NextResponse.json(
				{
					error:
						"Missing required fields: chatRoomId and non-empty content or file attachment(s)",
				},
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
				content: typeof content === "string" ? content : "",
				fileUrl,
				fileName,
				fileSize,
				attachments,
				replyData,
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
