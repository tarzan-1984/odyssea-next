import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** US ZIP code pattern: 5 digits, optionally +4 (e.g. 90210 or 90210-1234) */
const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/**
 * "City, ST" pattern: two-letter state abbreviation (e.g. "Phoenix, AZ").
 * Does not match if the value already contains a ZIP in parentheses.
 */
const CITY_STATE_ABBR_PATTERN = /^([^,]+),\s*([A-Za-z]{2})\s*$/;

/** Maps US state abbreviations to full names */
const STATE_ABBR_TO_NAME: Record<string, string> = {
	AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
	CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
	HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
	KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
	MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
	MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
	NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
	OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
	SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
	VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
	DC: "District of Columbia",
};

/**
 * POST /api/offers/geocode-to-formatted
 * Geocodes a ZIP code or "City, ST" abbreviation and returns "City, State ZIP" format.
 * - ZIP input: uses Nominatim to get city + state
 * - "City, ST" input: uses Zippopotam.us to get ZIP, maps abbreviation to full state name
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

		const isZip = ZIP_PATTERN.test(input.replace(/\s/g, ""));
		const cityStateMatch = CITY_STATE_ABBR_PATTERN.exec(input);

		// Only geocode for ZIP or "City, ST" format
		if (!isZip && !cityStateMatch) {
			return NextResponse.json({ formattedAddress: input }, { status: 200 });
		}

		// --- Handle "City, ST" via Zippopotam.us ---
		if (cityStateMatch) {
			const cityRaw = cityStateMatch[1].trim();
			const stateAbbr = cityStateMatch[2].toUpperCase();
			const stateFull = STATE_ABBR_TO_NAME[stateAbbr] ?? stateAbbr;

			try {
				// Zippopotam.us: GET /us/:state/:city
				const zippUrl = `https://api.zippopotam.us/us/${encodeURIComponent(stateAbbr)}/${encodeURIComponent(cityRaw)}`;
				const zippRes = await fetch(zippUrl, {
					headers: { "Accept": "application/json" },
				});

				if (zippRes.ok) {
					const zippData = (await zippRes.json()) as {
						places?: Array<{ "post code"?: string; "place name"?: string }>;
					};
					const firstPlace = zippData.places?.[0];
					const zip = firstPlace?.["post code"];
					const placeName = firstPlace?.["place name"] ?? cityRaw;

					if (zip) {
						return NextResponse.json(
							{ formattedAddress: `${placeName}, ${stateFull} ${zip}` },
							{ status: 200 }
						);
					}
				}
			} catch {
				// Fall through to Nominatim fallback
			}

			// Fallback: Nominatim for City, ST
			try {
				const params = new URLSearchParams({
					q: `${cityRaw}, ${stateAbbr}, USA`,
					format: "json",
					limit: "5",
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
				if (res.ok) {
					const data = (await res.json()) as Array<{
						address?: {
							city?: string; town?: string; village?: string;
							municipality?: string; state?: string; postcode?: string;
						};
					}>;
					const withZip = data.find((r) => r.address?.postcode);
					if (withZip?.address) {
						const addr = withZip.address;
						const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? cityRaw;
						const zip = addr.postcode!;
						return NextResponse.json(
							{ formattedAddress: `${city}, ${stateFull} ${zip}` },
							{ status: 200 }
						);
					}
				}
			} catch {
				// Keep original value on error
			}

			// No ZIP found — return with full state name at least
			return NextResponse.json(
				{ formattedAddress: `${cityRaw}, ${stateFull}` },
				{ status: 200 }
			);
		}

		// --- Handle ZIP via Nominatim ---
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
		const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
		const state = addr.state ?? "";
		const postcode = addr.postcode ?? input;

		let formatted: string;
		if (city && state && postcode) {
			formatted = `${city}, ${state} ${postcode}`;
		} else if (city && state) {
			formatted = `${city}, ${state}`;
		} else {
			formatted = input;
		}

		return NextResponse.json({ formattedAddress: formatted }, { status: 200 });
	} catch (error) {
		console.error("Error geocoding to formatted address:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
