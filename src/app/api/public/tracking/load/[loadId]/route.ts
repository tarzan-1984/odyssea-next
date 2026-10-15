import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/public/tracking/load/[loadId] — map data for signed-in users.
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		if (!serverAuth.getAccessToken(request)) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/public/tracking/load/${encodeURIComponent(loadId.trim())}`;

		const response = await fetch(backendUrl, {
			method: "GET",
			cache: "no-store",
		});

		const rawText = await response.text();
		let data: unknown = null;
		try {
			data = rawText ? JSON.parse(rawText) : null;
		} catch {
			return NextResponse.json(
				{ error: rawText || "Invalid response from tracking API" },
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
						"Failed to load tracking data",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting public load tracking:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
