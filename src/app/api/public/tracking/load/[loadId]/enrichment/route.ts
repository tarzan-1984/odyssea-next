import { NextRequest, NextResponse } from "next/server";

// POST /api/public/tracking/load/[loadId]/enrichment — DB data for guests (no auth).
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));

		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/public/tracking/load/${encodeURIComponent(loadId.trim())}/enrichment`;

		const response = await fetch(backendUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			cache: "no-store",
		});

		const rawText = await response.text();
		let data: unknown = null;
		try {
			data = rawText ? JSON.parse(rawText) : null;
		} catch {
			return NextResponse.json(
				{ error: rawText || "Invalid response from enrichment API" },
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
						"Failed to load enrichment",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting public load enrichment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
