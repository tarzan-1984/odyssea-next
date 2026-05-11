import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/**
 * Proxies Nominatim search server-side so the browser avoids CORS and can send a proper User-Agent
 * (required by https://operations.osmfoundation.org/policies/nominatim/).
 *
 * GET /api/geocode/nominatim-search?q=...&format=json&limit=1 ...
 * Forwards allowed query params to nominatim.openstreetmap.org/search.
 */
const ALLOWED_FORWARD_PARAMS = [
	"q",
	"format",
	"limit",
	"addressdetails",
	"accept-language",
	"countrycodes",
] as const;

export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const incoming = request.nextUrl.searchParams;
		const q = incoming.get("q")?.trim();
		if (!q) {
			return NextResponse.json({ error: "Query parameter q is required" }, { status: 400 });
		}

		const forward = new URLSearchParams();
		for (const key of ALLOWED_FORWARD_PARAMS) {
			const v = incoming.get(key);
			if (v != null && v !== "") {
				forward.set(key, v);
			}
		}
		if (!forward.has("format")) {
			forward.set("format", "json");
		}

		const nominatimUrl = `https://nominatim.openstreetmap.org/search?${forward.toString()}`;
		const userAgent =
			process.env.NOMINATIM_USER_AGENT?.trim() ||
			"OdysseaWeb/1.0 (load-tracking; https://odyssea-web-app.vercel.app)";

		const upstream = await fetch(nominatimUrl, {
			headers: {
				"User-Agent": userAgent,
				Accept: "application/json",
			},
			cache: "no-store",
		});

		const bodyText = await upstream.text();
		return new NextResponse(bodyText, {
			status: upstream.status,
			headers: {
				"Content-Type": upstream.headers.get("Content-Type") || "application/json",
			},
		});
	} catch (error) {
		console.error("[api/geocode/nominatim-search]", error);
		return NextResponse.json({ error: "Geocoding proxy failed" }, { status: 502 });
	}
}
