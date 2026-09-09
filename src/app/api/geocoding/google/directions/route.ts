import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
	const originLat = request.nextUrl.searchParams.get("originLat")?.trim() ?? "";
	const originLng = request.nextUrl.searchParams.get("originLng")?.trim() ?? "";
	const destination = request.nextUrl.searchParams.get("destination")?.trim() ?? "";
	const destinations = request.nextUrl.searchParams
		.getAll("destinations")
		.map(item => item.trim())
		.filter(item => item.length >= 3);

	if (!originLat || !originLng || (destination.length < 3 && destinations.length === 0)) {
		return NextResponse.json(
			{ error: "originLat, originLng and destination or destinations are required" },
			{ status: 400 }
		);
	}

	const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backendBase) {
		return NextResponse.json({ error: "Backend URL is not configured" }, { status: 500 });
	}

	const qs = new URLSearchParams({
		originLat,
		originLng,
	});
	if (destinations.length > 0) {
		for (const item of destinations) {
			qs.append("destinations", item);
		}
	} else {
		qs.set("destination", destination);
	}

	try {
		const response = await fetch(`${backendBase}/v1/geocoding/google/directions?${qs.toString()}`, {
			method: "GET",
			cache: "no-store",
		});
		const rawText = await response.text();
		let data: unknown = null;
		try {
			data = rawText ? JSON.parse(rawText) : null;
		} catch {
			return NextResponse.json(
				{ error: rawText || "Invalid response from directions API" },
				{ status: response.status >= 400 ? response.status : 502 }
			);
		}

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string })?.message ||
						(data as { error?: string })?.error ||
						rawText ||
						"Failed to load Google directions",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("[google/directions] proxy failed:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
