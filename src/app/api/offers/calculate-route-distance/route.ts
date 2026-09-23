import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import {
	buildGoogleDirectionsQuery,
	parseGoogleDirectionsBody,
	type GooglePickupRoute,
} from "@/lib/fetchGooglePickupDirections";
import {
	applyGoogleWaypointsToLocations,
	enrichStopsWithPostal,
	mergeChunkedWaypoints,
	type GoogleRouteWaypointLike,
	type PostalReverseHit,
} from "@/utils/offerGoogleRoute";

export const maxDuration = 180;

const METERS_TO_MILES = 1 / 1609.344;
const MAX_GOOGLE_DESTINATIONS = 9;

async function googleRoute(
	origin: string,
	destinations: string[]
): Promise<GooglePickupRoute | null> {
	const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backendBase) return null;

	const qs = buildGoogleDirectionsQuery(origin, destinations);
	const response = await fetch(`${backendBase}/v1/geocoding/google/directions?${qs.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
	if (!response.ok) return null;

	const body: unknown = await response.json().catch(() => null);
	return parseGoogleDirectionsBody(body);
}

async function reversePostalFromGeoZips(
	latitude: number,
	longitude: number,
): Promise<PostalReverseHit | null> {
	const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backendBase) return null;

	const qs = new URLSearchParams({
		latitude: String(latitude),
		longitude: String(longitude),
	});
	const response = await fetch(`${backendBase}/v1/geocoding/geo-zips/reverse?${qs.toString()}`, {
		method: "GET",
		cache: "no-store",
	});
	if (!response.ok) return null;

	const body: unknown = await response.json().catch(() => null);
	// Nest TransformInterceptor wraps as { data: { success, data: { zip, ... } } }
	let current: unknown = body;
	for (let i = 0; i < 4 && current != null && typeof current === "object"; i++) {
		const record = current as Record<string, unknown>;
		const nested = record.data;
		if (
			nested != null &&
			typeof nested === "object" &&
			typeof (nested as Record<string, unknown>).zip === "string"
		) {
			const hit = nested as {
				zip?: string | null;
				city?: string | null;
				stateCode?: string | null;
			};
			const zip = hit.zip?.trim();
			if (!zip) return null;
			return {
				postal: zip,
				city: hit.city?.trim() || null,
				regionCode: hit.stateCode?.trim() || null,
			};
		}
		if (record.success === false) return null;
		current = nested;
	}
	return null;
}

/**
 * POST /api/offers/calculate-route-distance
 * One Google Maps request (chunked if needed) that validates stops, fills
 * city/state/ZIP + coordinates, and returns loaded miles.
 * Missing ZIPs are filled via geo_zips reverse on Google waypoint coords.
 * Body: { locations: string[] }
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
		let waypoints: GoogleRouteWaypointLike[] = [];

		while (originIndex < locations.length - 1) {
			const destinations = locations.slice(
				originIndex + 1,
				originIndex + 1 + MAX_GOOGLE_DESTINATIONS
			);
			const route = await googleRoute(locations[originIndex], destinations);
			if (!route) {
				return NextResponse.json(
					{ error: "Could not calculate route between addresses" },
					{ status: 400 }
				);
			}

			totalMeters += route.distanceMeters;
			waypoints = mergeChunkedWaypoints(waypoints, route.waypoints, originIndex === 0);
			originIndex += destinations.length;
		}

		const loadedMiles = totalMeters * METERS_TO_MILES;
		const stops = await enrichStopsWithPostal(
			applyGoogleWaypointsToLocations(locations, waypoints),
			reversePostalFromGeoZips,
		);

		return NextResponse.json({ loadedMiles, stops }, { status: 200 });
	} catch (error) {
		console.error("Error calculating route distance:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
