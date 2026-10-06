import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/**
 * PATCH /api/offers/return-offers
 * Proxies to backend PATCH /v1/offers/return-offers.
 * Requires authentication.
 */
export async function PATCH(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/return-offers`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message ?? data.error ?? "Failed to return offers" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error returning offers:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
