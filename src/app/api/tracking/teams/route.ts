import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import {
	canAccessMyLoadsChatTab,
	canAccessMyTeamChatTab,
} from "@/utils/roleAccess";
import { extractTrackingTeamsLoadIds } from "@/app-api/trackingTeams";

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
			searchParams.get("refresh") === "1" ||
			searchParams.get("refresh") === "true";

		if (includeSubordinates && !canAccessMyTeamChatTab(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const qs = new URLSearchParams();
		if (includeSubordinates) qs.set("include_subordinates", "1");
		if (refresh) qs.set("refresh", "1");

		const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
		if (!backendUrl) {
			return NextResponse.json(
				{ error: "NEXT_PUBLIC_BACKEND_URL is not configured" },
				{ status: 500 },
			);
		}

		const response = await fetch(
			`${backendUrl}/v1/tracking/teams${
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

		const raw = await response.text();
		let data: Record<string, unknown> = {};
		try {
			data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
		} catch {
			return NextResponse.json(
				{
					error: "Backend returned non-JSON for tracking/teams",
					nestStatus: response.status,
					preview: raw.slice(0, 300),
				},
				{ status: 502 },
			);
		}

		if (!response.ok) {
			const nested =
				data.data && typeof data.data === "object"
					? (data.data as Record<string, unknown>)
					: null;
			const tmsStatus = data.tmsStatus ?? nested?.tmsStatus ?? null;
			const tmsUrl = data.tmsUrl ?? nested?.tmsUrl ?? null;
			const tmsBody = data.tmsBody ?? nested?.tmsBody ?? null;
			const detail = data.detail ?? nested?.detail ?? null;
			console.error("[tracking/teams] Nest/TMS error", {
				nestStatus: response.status,
				tmsStatus,
				tmsUrl,
				tmsBody,
				detail,
			});
			return NextResponse.json(
				{
					error:
						(typeof data.message === "string" && data.message) ||
						(typeof data.error === "string" && data.error) ||
						(typeof nested?.message === "string" && nested.message) ||
						"Failed to load tracking teams",
					nestStatus: response.status,
					tmsStatus,
					tmsUrl,
					tmsBody,
					detail,
					nestBody: data,
				},
				{ status: response.status },
			);
		}

		// Nest wraps as { data: payload }. Walk data.data… and always return a flat loadIds list.
		const loadIds = extractTrackingTeamsLoadIds(data);
		return NextResponse.json({
			success: true,
			loadIds,
			total: loadIds.length,
			includeSubordinates,
			cached: Boolean(
				data?.cached ??
					(data?.data as { cached?: unknown } | undefined)?.cached,
			),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Internal server error";
		console.error("Error loading tracking teams:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
