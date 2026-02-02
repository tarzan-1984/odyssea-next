import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

const PAGE_SIZE = 100;

export interface DriverForMap {
	id: string;
	externalId: string | null;
	latitude: number;
	longitude: number;
	driverStatus: string | null;
	status?: string | null;
	zip?: string | null;
}

export interface DriversMapResponse {
	drivers: DriverForMap[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
}

/**
 * GET /api/users/drivers/map
 * Returns paginated drivers for map display (coordinates + status).
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
		const limit = Math.min(
			200,
			Math.max(1, parseInt(searchParams.get("limit") || String(PAGE_SIZE), 10))
		);
		const company = searchParams.get("company") || undefined;

		const queryParams = new URLSearchParams();
		queryParams.set("page", String(page));
		queryParams.set("limit", String(limit));
		if (company) queryParams.set("company", company);

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/drivers/map?${queryParams.toString()}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to fetch drivers for map" },
				{ status: response.status }
			);
		}

		// Backend may wrap response in { data: {...} }
		const payload = data.data ?? data;
		const drivers = Array.isArray(payload?.drivers) ? payload.drivers : [];
		const pagination = payload?.pagination ?? {
			current_page: page,
			per_page: limit,
			total_count: drivers.length,
			total_pages: 1,
			has_next_page: false,
			has_prev_page: false,
		};

		return NextResponse.json({
			drivers: drivers.filter(
				(d: DriverForMap) =>
					typeof d.latitude === "number" &&
					typeof d.longitude === "number" &&
					!Number.isNaN(d.latitude) &&
					!Number.isNaN(d.longitude)
			),
			pagination,
		});
	} catch (error) {
		console.error("Error fetching drivers for map:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
