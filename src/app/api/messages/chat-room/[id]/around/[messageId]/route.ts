import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

type RouteParams = { params: Promise<{ id: string; messageId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id, messageId } = await params;
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/chat-room/${id}/around/${messageId}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				signal: request.signal,
			}
		);

		const data = await response.json();
		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to open pinned message" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			return new NextResponse(null, { status: 499 });
		}
		console.error("Error fetching messages around pin:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
