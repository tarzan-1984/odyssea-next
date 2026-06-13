import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/sync-batch`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(body),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to sync messages" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error syncing messages batch:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
