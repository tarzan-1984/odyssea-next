import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL_TMS ?? "").replace(/\/$/, "");
const TMS_DRIVER_SEARCH_URL = `${TMS_BASE_URL}/v1/driver/search`;
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

/** Optional query params for TMS driver search (all optional) */
const SEARCH_PARAMS = [
	"my_search",
	"extended_search",
	"status_filter",
	"radius",
	"country",
	"capabilities",
	"paged",
	"per_page_loads",
	"role",
	"dim_min_1",
	"dim_min_2",
	"dim_min_3",
] as const;

function parseExcludeAtOpenBidLimit(value: string | null): boolean {
	const trimmed = value?.trim().toLowerCase() ?? "";
	return trimmed === "1" || trimmed === "true" || trimmed === "yes";
}

async function fetchDriverExternalIdsAtOpenBidLimit(
	accessToken: string
): Promise<string[]> {
	const backend = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backend) return [];
	try {
		const response = await fetch(
			`${backend}/v1/offers/drivers-at-open-bid-limit`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			}
		);
		if (!response.ok) return [];
		const json = (await response.json().catch(() => null)) as {
			driverExternalIds?: unknown;
		} | null;
		return Array.isArray(json?.driverExternalIds)
			? json.driverExternalIds.map((id) => String(id).trim()).filter(Boolean)
			: [];
	} catch {
		return [];
	}
}

/**
 * GET /api/users/drivers/search
 * Proxies to TMS driver search API with optional query params:
 * - my_search: Address or place to search drivers near (geocoding + distance filter)
 * - extended_search: Unit, name, phone, or vehicle text search (mutually exclusive with my_search)
 * - status_filter: Driver status filter (e.g. for_offers, Available)
 * - radius: Radius in miles when using my_search
 * - country: Country filter
 * - capabilities: Comma-separated list (e.g. twic,lift_gate,hazmat_certificate)
 * - paged: Page number (default: 1)
 * - dim_min_1, dim_min_2, dim_min_3: Minimum cargo dimensions (length, width, height)
 * - exclude_at_open_bid_limit: if true, include driverExternalIdsAtOpenBidLimit (do not hide them)
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const requesterId = serverAuth.getUserData(request)?.externalId?.trim() ?? "";

		const { searchParams } = new URL(request.url);
		const query = new URLSearchParams();

		for (const key of SEARCH_PARAMS) {
			const value = searchParams.get(key)?.trim();
			if (value) {
				query.set(key, value);
			}
		}

		// Default paged=1 if not provided
		if (!query.has("paged")) {
			query.set("paged", "1");
		}

		if (requesterId) {
			query.set("user_id", requesterId);
		}

		const excludeAtOpenBidLimit = parseExcludeAtOpenBidLimit(
			searchParams.get("exclude_at_open_bid_limit")
		);
		const url = `${TMS_DRIVER_SEARCH_URL}?${query.toString()}`;

		const tmsRequest = axios.get(url, {
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": TMS_API_KEY,
			},
			validateStatus: () => true,
		});

		const [response, atLimitIds] = await Promise.all([
			tmsRequest,
			excludeAtOpenBidLimit
				? fetchDriverExternalIdsAtOpenBidLimit(accessToken)
				: Promise.resolve([] as string[]),
		]);

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{ error: (data as any)?.message || "TMS driver search failed" },
				{ status }
			);
		}

		const payload =
			data && typeof data === "object" && !Array.isArray(data)
				? {
						...(data as Record<string, unknown>),
						...(excludeAtOpenBidLimit
							? { driverExternalIdsAtOpenBidLimit: atLimitIds }
							: {}),
					}
				: data;

		return NextResponse.json(payload, { status: 200 });
	} catch (error) {
		console.error("Error in driver search:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
