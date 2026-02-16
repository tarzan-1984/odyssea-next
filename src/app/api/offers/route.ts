import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

const OFFERS_QUERY_PARAMS = ["page", "limit", "is_expired", "user_id", "sort_order"] as const;

/**
 * GET /api/offers
 * Proxies to backend GET /v1/offers with pagination and filters.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const query = new URLSearchParams();
		for (const key of OFFERS_QUERY_PARAMS) {
			const value = searchParams.get(key);
			if (value != null && value !== "") {
				query.set(key, value);
			}
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers${query.toString() ? `?${query.toString()}` : ""}`;
		const response = await fetch(url, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message ?? data.error ?? "Failed to fetch offers" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching offers:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
