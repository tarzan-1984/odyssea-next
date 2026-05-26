import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// POST /api/tms/load/[loadId]/enrichment — DB drivers, tracking, route geocode (Nest).
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));

		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/tms/load/${encodeURIComponent(loadId.trim())}/enrichment`;

		const response = await fetch(backendUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
			cache: "no-store",
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string })?.message ||
						(data as { error?: string })?.error ||
						"Failed to load enrichment",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting load enrichment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
