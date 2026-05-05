import { NextRequest, NextResponse } from "next/server";

// GET /api/tms/load/[loadId] - public proxy for TMS load details.
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	try {
		const { loadId } = await params;

		if (!loadId) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/tms/load/${encodeURIComponent(loadId)}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to get load details" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting TMS load details:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
