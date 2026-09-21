import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** Proxies GET /v1/message-templates/favorites → Nest (JWT). */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/message-templates/favorites`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			const err = data as { message?: unknown; error?: string };
			const messageStr =
				typeof err.message === "string"
					? err.message
					: err.error ?? "Failed to fetch favorite templates";
			return NextResponse.json({ error: messageStr }, { status: response.status });
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching favorite message templates:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
