import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { geocodeOfferToFormattedAddress } from "@/utils/offerLocationGeocode";

/**
 * POST /api/offers/geocode-to-formatted
 * Geocodes a postal code or "City, ST" and returns formatted location (US / Canada / Mexico).
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

		const formattedAddress = await geocodeOfferToFormattedAddress(input);
		return NextResponse.json({ formattedAddress }, { status: 200 });
	} catch (error) {
		console.error("Error geocoding to formatted address:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
