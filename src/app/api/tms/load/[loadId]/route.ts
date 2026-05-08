import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/tms/load/[loadId] - TMS load details + drivers + tracking history (authenticated).
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

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
					Authorization: `Bearer ${accessToken}`,
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
