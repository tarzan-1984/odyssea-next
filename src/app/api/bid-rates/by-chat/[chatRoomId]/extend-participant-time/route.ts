import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * POST /api/bid-rates/by-chat/:chatRoomId/extend-participant-time
 * Extends a participant +1 timer by +15 minutes on updated_at.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ chatRoomId: string }> },
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessBidRates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { chatRoomId } = await params;
		if (!chatRoomId?.trim()) {
			return NextResponse.json({ error: "Invalid chat room id" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/extend-participant-time`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					userId: typeof body?.userId === "string" ? body.userId : undefined,
				}),
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						data.message ||
						data.error ||
						(Array.isArray(data.message) ? data.message.join(", ") : null) ||
						"Failed to extend participant timer",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error extending participant timer:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
