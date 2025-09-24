import { NextRequest, NextResponse } from "next/server";
import { tokenEncoder } from "@/utils/tokenEncoder";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { refreshToken } = body;

		if (!refreshToken) {
			return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
		}

		// Decode the refresh token before sending to backend
		// since backend expects plain JWT token, not encoded
		const decodedRefreshToken = tokenEncoder.decode(refreshToken);

		// Get access token from Authorization header if present
		const authHeader = request.headers.get("authorization");
		const accessToken = authHeader ? authHeader.replace("Bearer ", "") : null;

		// Decode access token if it's encoded
		const decodedAccessToken = accessToken ? tokenEncoder.decode(accessToken) : null;

		// Send request to backend for logout
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/logout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(decodedAccessToken && { Authorization: `Bearer ${decodedAccessToken}` }),
			},
			body: JSON.stringify({
				refreshToken: decodedRefreshToken, // Send decoded token to backend
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to logout" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during logout:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
