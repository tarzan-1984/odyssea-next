import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * POST /api/bid-rates/by-chat/:chatRoomId/join
 * Registers current user in bid_rate_participants (one +1 per bid).
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

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates/by-chat/${encodeURIComponent(chatRoomId)}/join`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
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
						"Failed to join bid",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error joining bid:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
