import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * GET /api/bid-rates/:id/participants
 * Lists bid_rate_participants (+1) with names and timestamps.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
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

		const { id } = await params;
		const bidId = Number(id);
		if (!Number.isFinite(bidId) || bidId <= 0) {
			return NextResponse.json({ error: "Invalid bid rate id" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates/${bidId}/participants`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						data.message ||
						data.error ||
						"Failed to load bid participants",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error loading bid participants:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
