import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { geocodeOfferAddressCoordinates } from "@/utils/offerLocationGeocode";

const METERS_TO_MILES = 1 / 1609.344;
const NOMINATIM_DELAY_MS = 1100;

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/** Get road distance in meters between two points via OSRM. Returns null on failure. */
async function getOsrmDistanceMeters(
	from: { lat: number; lon: number },
	to: { lat: number; lon: number }
): Promise<number | null> {
	const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
	const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`;

	const res = await fetch(url);
	if (!res.ok) return null;

	const data = (await res.json()) as { routes?: Array<{ distance: number }> };
	if (!data.routes?.[0] || typeof data.routes[0].distance !== "number") return null;

	return data.routes[0].distance;
}

/**
 * POST /api/offers/calculate-route-distance
 * Calculates road distance (miles) for a sequence of addresses using Nominatim + OSRM.
 * Body: { locations: string[] }
 * Returns: { loadedMiles: number } or { error: string }
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = (await request.json()) as { locations?: string[] };
		const locations = Array.isArray(body.locations) ? body.locations : [];

		if (locations.length < 2) {
			return NextResponse.json(
				{ error: "At least 2 locations required for distance calculation" },
				{ status: 400 }
			);
		}

		const coords: { lat: number; lon: number }[] = [];
		for (let i = 0; i < locations.length; i++) {
			if (i > 0) await sleep(NOMINATIM_DELAY_MS);

			const point = await geocodeOfferAddressCoordinates(String(locations[i]));
			if (!point) {
				return NextResponse.json(
					{ error: `Could not geocode address: ${String(locations[i]).slice(0, 80)}` },
					{ status: 400 }
				);
			}
			coords.push(point);
		}

		let totalMeters = 0;
		for (let i = 0; i < coords.length - 1; i++) {
			const dist = await getOsrmDistanceMeters(coords[i], coords[i + 1]);
			if (dist == null) {
				return NextResponse.json(
					{ error: "Could not calculate route between addresses" },
					{ status: 400 }
				);
			}
			totalMeters += dist;
		}

		const loadedMiles = totalMeters * METERS_TO_MILES;

		return NextResponse.json({ loadedMiles }, { status: 200 });
	} catch (error) {
		console.error("Error calculating route distance:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
