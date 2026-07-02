import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { geocodeOfferAddressCoordinates } from "@/utils/offerLocationGeocode";

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

		const point = await geocodeOfferAddressCoordinates(address);
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
