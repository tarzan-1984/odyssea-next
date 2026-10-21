import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { id: messageId } = await params;
		if (!messageId) {
			return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
		}

		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/${messageId}/pin`;
		const response = await fetch(backendUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const errorData = await response.text();
			return NextResponse.json({ error: errorData }, { status: response.status });
		}

		return NextResponse.json(await response.json());
	} catch (error) {
		console.error("Error pinning message:", error);
		return NextResponse.json({ error: "Failed to pin message" }, { status: 500 });
	}
}
