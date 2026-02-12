import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_DRIVER_SEARCH_URL = "https://www.endurance-tms.com/wp-json/tms/v1/driver/search";
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

/** Optional query params for TMS driver search (all optional) */
const SEARCH_PARAMS = [
	"my_search",
	"extended_search",
	"radius",
	"country",
	"capabilities",
	"paged",
	"per_page_loads",
] as const;

/**
 * GET /api/users/drivers/search
 * Proxies to TMS driver search API with optional query params:
 * - my_search: Address or place to search drivers near (geocoding + distance filter)
 * - extended_search: Extended search filter (same as Driver Search page)
 * - radius: Radius in miles when using my_search
 * - country: Country filter
 * - capabilities: Comma-separated list (e.g. twic,lift_gate,hazmat_certificate)
 * - paged: Page number (default: 1)
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

		for (const key of SEARCH_PARAMS) {
			const value = searchParams.get(key);
			if (value != null && value !== "") {
				query.set(key, value);
			}
		}

		// Default paged=1 if not provided
		if (!query.has("paged")) {
			query.set("paged", "1");
		}

		const url = `${TMS_DRIVER_SEARCH_URL}?${query.toString()}`;

		const response = await axios.get(url, {
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": TMS_API_KEY,
			},
			// Не выбрасывать исключение для не-2xx, чтобы обработать статус вручную.
			validateStatus: () => true,
		});

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{ error: (data as any)?.message || "TMS driver search failed" },
				{ status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error in driver search:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
