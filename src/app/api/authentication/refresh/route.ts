import { NextRequest, NextResponse } from "next/server";
import { tokenEncoder } from "@/utils/tokenEncoder";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { refreshToken } = body;

		if (!refreshToken) {
			return NextResponse.json({ error: "Refresh token is required" }, { status: 400 });
		}

		// Send request to backend for token refresh
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/refresh`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				refreshToken,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to refresh token" },
				{ status: response.status }
			);
		}

		// Encode new access token before returning it
		if (data.accessToken) {
			data.accessToken = tokenEncoder.encode(data.accessToken);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during token refresh:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
