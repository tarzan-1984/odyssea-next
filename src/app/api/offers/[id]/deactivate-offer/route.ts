import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/**
 * PATCH /api/offers/[id]/deactivate-offer
 * Proxies to backend PATCH /v1/offers/:id/deactivate-offer to set active=false.
 * Requires authentication.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		if (!id) {
			return NextResponse.json({ error: "Offer id is required" }, { status: 400 });
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${encodeURIComponent(id)}/deactivate-offer`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message ?? data.error ?? "Failed to deactivate offer" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error deactivating offer:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
