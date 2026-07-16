import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * PATCH /api/bid-rates/:id/new-price
 * Updates bid price: bid_rates.rate when no active +1 timers,
 * otherwise bid_rate_participants.rate for the owner.
 */
export async function PATCH(
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

		const body = await request.json().catch(() => null);
		if (!body || typeof body !== "object") {
			return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates/${bidId}/new-price`,
			{
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
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
						"Failed to update bid price",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error updating bid price:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
