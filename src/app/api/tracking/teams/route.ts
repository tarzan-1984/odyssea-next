import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import {
	canAccessMyLoadsChatTab,
	canAccessMyTeamChatTab,
} from "@/utils/roleAccess";

/**
 * GET /api/tracking/teams
 * Proxies Nest GET /v1/tracking/teams (TMS load ids for My Loads / My Team tabs).
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessMyLoadsChatTab(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const includeSubordinates =
			searchParams.get("include_subordinates") === "1" ||
			searchParams.get("include_subordinates") === "true";
		const refresh =
			searchParams.get("refresh") === "1" || searchParams.get("refresh") === "true";

		if (includeSubordinates && !canAccessMyTeamChatTab(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const qs = new URLSearchParams();
		if (includeSubordinates) qs.set("include_subordinates", "1");
		if (refresh) qs.set("refresh", "1");

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/tracking/teams${
				qs.toString() ? `?${qs.toString()}` : ""
			}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			},
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || data?.data?.message || "Failed to load tracking teams" },
				{ status: response.status },
			);
		}

		// Nest TransformInterceptor wraps as { data: payload, timestamp, path }
		const payload = data?.data && typeof data.data === "object" ? data.data : data;
		return NextResponse.json(payload);
	} catch (error) {
		console.error("Error loading tracking teams:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
