import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

function formatBackendError(errorData: {
	message?: unknown;
	error?: unknown;
}): string {
	const candidate = errorData.message ?? errorData.error;
	if (typeof candidate === "string" && candidate.trim()) {
		return candidate;
	}
	if (Array.isArray(candidate)) {
		const messages = candidate
			.map(item => {
				if (typeof item === "string") return item;
				if (item && typeof item === "object" && "constraints" in item) {
					const constraints = (item as { constraints?: Record<string, string> }).constraints;
					return constraints ? Object.values(constraints).join(", ") : "";
				}
				return "";
			})
			.filter(Boolean);
		if (messages.length > 0) {
			return messages.join("; ");
		}
	}
	return "Failed to mark all messages as read";
}

export async function PUT(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const { chatRoomIds } = body;

		if (!chatRoomIds || !Array.isArray(chatRoomIds) || chatRoomIds.length === 0) {
			return NextResponse.json(
				{ error: "chatRoomIds array is required and must not be empty" },
				{ status: 400 }
			);
		}

		const response = await fetch(`${BACKEND_URL}/v1/messages/read-all`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ chatRoomIds }),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return NextResponse.json(
				{ error: formatBackendError(errorData) },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json({ data: data.data ?? data }, { status: 200 });
	} catch (error) {
		console.error("Error marking all messages as read:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
