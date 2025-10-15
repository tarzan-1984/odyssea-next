import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		// Get access token from server-side authentication
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
		}

		// Proxy request to backend using NEXT_PUBLIC_BACKEND_URL
		const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

		const response = await fetch(`${backendUrl}/v1/notifications/mark-all-read`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Backend responded with status: ${response.status} - ${errorText}`);
		}

		const data = await response.json();

		// Backend already returns wrapped response, so return it directly
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error marking all notifications as read:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 }
		);
	}
}
