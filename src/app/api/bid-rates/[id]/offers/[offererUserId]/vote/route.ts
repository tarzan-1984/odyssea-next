import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * POST /api/bid-rates/:id/offers/:offererUserId/vote
 * Accept or reject a participant rate offer.
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; offererUserId: string }> },
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

		const { id, offererUserId } = await params;
		const bidId = Number(id);
		if (!Number.isFinite(bidId) || bidId <= 0) {
			return NextResponse.json({ error: "Invalid bid rate id" }, { status: 400 });
		}
		if (!offererUserId?.trim()) {
			return NextResponse.json({ error: "Invalid offerer user id" }, { status: 400 });
		}

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object" || typeof body.accept !== "boolean") {
			return NextResponse.json(
				{ error: "Body must include boolean accept" },
				{ status: 400 },
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates/${bidId}/offers/${encodeURIComponent(offererUserId)}/vote`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ accept: body.accept }),
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
						(Array.isArray(data.message) ? data.message.join(", ") : null) ||
						"Failed to vote on offer",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error voting on bid offer:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
