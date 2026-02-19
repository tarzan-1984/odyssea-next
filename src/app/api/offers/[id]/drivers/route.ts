import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/**
 * PATCH /api/offers/[id]/drivers
 * Proxies to backend PATCH /v1/offers/:id/drivers with body { driverIds: string[] }.
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

		const body = await request.json();
		const driverIds = Array.isArray(body?.driverIds)
			? body.driverIds.map((x: unknown) => String(x).trim()).filter(Boolean)
			: [];
		if (driverIds.length === 0) {
			return NextResponse.json(
				{ error: "At least one driver ID is required" },
				{ status: 400 }
			);
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${encodeURIComponent(id)}/drivers`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ driverIds }),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message ?? data.error ?? "Failed to add drivers to offer" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error adding drivers to offer:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
