import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";
import { canAccessCheckList } from "@/utils/roleAccess";

type CheckListVersionApiPayload = {
	drivers: unknown[];
	minimumAppVersion: string;
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};

/**
 * GET /api/users/drivers/check-list/version?page=&limit=&search=
 * Proxies to NestJS drivers check-list/version (outdated app version).
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessCheckList(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const queryParams = new URLSearchParams();
		const page = searchParams.get("page");
		const limit = searchParams.get("limit");
		if (page) queryParams.set("page", page);
		if (limit) queryParams.set("limit", limit);
		const search = searchParams.get("search");
		if (search && search.trim() !== "") {
			queryParams.set("search", search.trim());
		}
		const sortParam = searchParams.get("appVersionSort")?.trim().toLowerCase();
		if (sortParam === "desc" || sortParam === "asc") {
			queryParams.set("appVersionSort", sortParam);
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/drivers/check-list/version?${queryParams.toString()}`;

		const response = await axios.get(url, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			validateStatus: () => true,
		});

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{ error: (data as { message?: string })?.message || "Failed to fetch check list version" },
				{ status }
			);
		}

		const payload =
			(data as { data?: CheckListVersionApiPayload })?.data ??
			(data as CheckListVersionApiPayload);
		const drivers = Array.isArray(payload?.drivers) ? payload.drivers : [];
		const minimumAppVersion =
			typeof payload?.minimumAppVersion === "string" ? payload.minimumAppVersion : "";
		const pagination = payload?.pagination ?? {
			current_page: page ? Math.max(1, parseInt(page, 10)) : 1,
			per_page: limit ? Math.max(1, parseInt(limit, 10)) : 10,
			total_count: drivers.length,
			total_pages: 1,
			has_next_page: false,
			has_prev_page: false,
		};

		return NextResponse.json({ drivers, minimumAppVersion, pagination }, { status: 200 });
	} catch (error) {
		const message =
			axios.isAxiosError(error) && error.response?.data
				? String((error.response.data as { error?: string }).error || error.message)
				: error instanceof Error
					? error.message
					: "Internal server error";
		console.error("Error fetching drivers check list version:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
