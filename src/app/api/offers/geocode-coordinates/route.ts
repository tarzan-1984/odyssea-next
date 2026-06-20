import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** Geocode address via Nominatim (OpenStreetMap). Returns { lat, lon } or null. */
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
	const trimmed = address.trim();
	if (!trimmed) return null;

	const query = trimmed.includes("USA") ? trimmed : `${trimmed}, USA`;
	const params = new URLSearchParams({
		q: query,
		format: "json",
		limit: "1",
		countrycodes: "us",
	});

	const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
		headers: {
			"User-Agent": "OdysseaApp/1.0 (geocode-coordinates)",
			"Accept-Language": "en",
		},
	});

	if (!res.ok) return null;

	const data = (await res.json()) as Array<{ lat: string; lon: string }>;
	if (!Array.isArray(data) || data.length === 0) return null;

	const lat = Number.parseFloat(data[0].lat);
	const lon = Number.parseFloat(data[0].lon);
	if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

	return { lat, lon };
}

/**
 * POST /api/offers/geocode-coordinates
 * Geocodes an address and returns latitude/longitude.
 * Body: { address: string }
 * Returns: { latitude: number, longitude: number } or { error: string }
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = (await request.json()) as { address?: string };
		const address = typeof body.address === "string" ? body.address.trim() : "";

		if (!address) {
			return NextResponse.json({ error: "Address is required" }, { status: 400 });
		}

		const point = await geocodeAddress(address);
		if (!point) {
			return NextResponse.json(
				{ error: `Could not geocode address: ${address.slice(0, 80)}` },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ latitude: point.lat, longitude: point.lon },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Error geocoding coordinates:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
