import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_LOAD_BASE_URL = "https://www.endurance-tms.com/wp-json/tms/v1/load";
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

// GET /api/tms/load/[loadId] — TMS load details only (same path as drivers/search → TMS).
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		const isPublicRequest = request.nextUrl.searchParams.get("public") === "1";
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken && !isPublicRequest) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		const url = new URL(
			`${TMS_LOAD_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(loadId.trim())}`
		);
		url.searchParams.set("project", "odysseia");
		url.searchParams.set("is_flt", "false");

		const response = await axios.get(url.toString(), {
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": TMS_API_KEY,
			},
			timeout: 30000,
			validateStatus: () => true,
		});

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string })?.message ||
						"Failed to get load details from TMS",
				},
				{ status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting TMS load details:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
