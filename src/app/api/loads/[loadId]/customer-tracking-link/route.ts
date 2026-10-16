import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { encryptLoadTrackingId } from "@/utils/loadTrackingToken";

// GET /api/loads/[loadId]/customer-tracking-link — encrypt a load id into /load-tracking/[token].
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;
	const cleanLoadId = loadId?.trim() ?? "";
	if (!cleanLoadId) {
		return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
	}

	if (!serverAuth.getAccessToken(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const token = encryptLoadTrackingId(cleanLoadId);
		return NextResponse.json(
			{ token, path: `/load-tracking/${token}` },
			{ status: 200, headers: { "Cache-Control": "no-store" } }
		);
	} catch (error) {
		console.error("Error creating customer tracking link:", error);
		return NextResponse.json({ error: "Failed to create tracking link" }, { status: 500 });
	}
}
