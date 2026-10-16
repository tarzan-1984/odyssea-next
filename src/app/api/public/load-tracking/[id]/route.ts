import { NextRequest, NextResponse } from "next/server";

function readCustomerView(body: unknown): Record<string, unknown> | null {
	if (!body || typeof body !== "object") return null;
	const root = body as Record<string, unknown>;
	const envelope = root.data;
	if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return null;
	const wrapped = envelope as Record<string, unknown>;
	const view = wrapped.data;
	if (!view || typeof view !== "object" || Array.isArray(view)) return null;
	return view as Record<string, unknown>;
}

// GET /api/public/load-tracking/[id] — customer map. id is an encrypted load token.
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const token = id?.trim() ?? "";
	if (!token) {
		return NextResponse.json({ error: "Tracking link is required" }, { status: 400 });
	}

	const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
	if (!backendBase) {
		return NextResponse.json({ error: "Backend URL is not configured" }, { status: 500 });
	}

	try {
		const response = await fetch(
			`${backendBase}/v1/public/load-tracking/${encodeURIComponent(token)}`,
			{ method: "GET", cache: "no-store" }
		);
		const rawText = await response.text();
		let data: unknown = null;
		try {
			data = rawText ? JSON.parse(rawText) : null;
		} catch {
			return NextResponse.json({ error: "Invalid response from tracking API" }, { status: 502 });
		}

		if (!response.ok) {
			const status = response.status === 400 || response.status === 404 ? response.status : 502;
			const message =
				status === 400
					? "This tracking link is invalid."
					: status === 404
						? "Shipment not found."
						: "Failed to load tracking.";
			return NextResponse.json({ error: message }, { status });
		}

		const view = readCustomerView(data);
		if (!view) {
			return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
		}

		return NextResponse.json(
			{ data: view },
			{ status: 200, headers: { "Cache-Control": "no-store" } }
		);
	} catch (error) {
		console.error("Error getting customer load tracking:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
