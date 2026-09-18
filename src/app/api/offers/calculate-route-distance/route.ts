import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import {
	buildGoogleDirectionsQuery,
	parseGoogleDirectionsBody,
} from "@/lib/fetchGooglePickupDirections";

export const maxDuration = 180;

const METERS_TO_MILES = 1 / 1609.344;
const MAX_GOOGLE_DESTINATIONS = 9;

async function googleDistanceMeters(
	origin: string,
	destinations: string[]
): Promise<number | null> {
	const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backendBase) return null;

	const qs = buildGoogleDirectionsQuery(origin, destinations);
	const response = await fetch(`${backendBase}/v1/geocoding/google/directions?${qs.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
	if (!response.ok) return null;

	const body: unknown = await response.json().catch(() => null);
	const route = parseGoogleDirectionsBody(body);
	return route ? route.distanceMeters : null;
}

/**
 * POST /api/offers/calculate-route-distance
 * Road miles for a sequence of addresses via Google Maps (first stop is origin).
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
		const locations = Array.isArray(body.locations)
			? body.locations.map(item => String(item).trim()).filter(Boolean)
			: [];

		if (locations.length < 2) {
			return NextResponse.json(
				{ error: "At least 2 locations required for distance calculation" },
				{ status: 400 }
			);
		}

		let totalMeters = 0;
		let originIndex = 0;

		while (originIndex < locations.length - 1) {
			const destinations = locations.slice(
				originIndex + 1,
				originIndex + 1 + MAX_GOOGLE_DESTINATIONS
			);
			const dist = await googleDistanceMeters(locations[originIndex], destinations);
			if (dist == null) {
				return NextResponse.json(
					{ error: "Could not calculate route between addresses" },
					{ status: 400 }
				);
			}

			totalMeters += dist;
			originIndex += destinations.length;
		}

		const loadedMiles = totalMeters * METERS_TO_MILES;

		return NextResponse.json({ loadedMiles }, { status: 200 });
	} catch (error) {
		console.error("Error calculating route distance:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
