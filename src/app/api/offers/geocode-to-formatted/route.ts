import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** US ZIP code pattern: 5 digits, optionally +4 (e.g. 90210 or 90210-1234) */
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * POST /api/offers/geocode-to-formatted
 * Geocodes a ZIP code or address via Nominatim and returns "City, State (ZIP)" format.
 * Body: { address: string }
 * Returns: { formattedAddress: string } or { error: string }
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = (await request.json()) as { address?: string };
		const input = typeof body.address === "string" ? body.address.trim() : "";

		if (!input) {
			return NextResponse.json({ error: "Address is required" }, { status: 400 });
		}

		// Only geocode when input looks like a ZIP code
		if (!ZIP_PATTERN.test(input.replace(/\s/g, ""))) {
			return NextResponse.json({ formattedAddress: input }, { status: 200 });
		}

		const query = input.includes("USA") ? input : `${input}, USA`;
		const params = new URLSearchParams({
			q: query,
			format: "json",
			limit: "1",
			addressdetails: "1",
			countrycodes: "us",
		});

		const res = await fetch(
			`https://nominatim.openstreetmap.org/search?${params.toString()}`,
			{
				headers: {
					"User-Agent": "OdysseaApp/1.0 (geocode-formatted)",
					"Accept-Language": "en",
				},
			}
		);

		if (!res.ok) {
			return NextResponse.json(
				{ error: "Geocoding service unavailable" },
				{ status: 502 }
			);
		}

		const data = (await res.json()) as Array<{
			address?: {
				city?: string;
				town?: string;
				village?: string;
				municipality?: string;
				state?: string;
				postcode?: string;
			};
		}>;

		if (!Array.isArray(data) || data.length === 0 || !data[0].address) {
			return NextResponse.json({ formattedAddress: input }, { status: 200 });
		}

		const addr = data[0].address;
		const city =
			addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
		const state = addr.state ?? "";
		const postcode = addr.postcode ?? input;

		// Format: "City, State (ZIP)"
		let formatted: string;
		if (city && state) {
			formatted = `${city}, ${state} (${postcode})`;
		} else if (city || state) {
			formatted = city || state;
			if (postcode && postcode !== input) {
				formatted += ` (${postcode})`;
			}
		} else {
			formatted = input;
		}

		return NextResponse.json({ formattedAddress: formatted }, { status: 200 });
	} catch (error) {
		console.error("Error geocoding to formatted address:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
