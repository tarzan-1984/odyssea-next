import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";
import { canAccessAppLogs } from "@/utils/roleAccess";

type DriverLogsApiPayload = {
	logs: unknown[];
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
 * GET /api/driver-logs?page=&limit=&search=
 * Proxies to NestJS driver_logs list (administrators only).
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessAppLogs(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const queryParams = new URLSearchParams();
		const page = searchParams.get("page");
		const limit = searchParams.get("limit");
		const search = searchParams.get("search");
		if (page) queryParams.set("page", page);
		if (limit) queryParams.set("limit", limit);
		if (search && search.trim() !== "") {
			queryParams.set("search", search.trim());
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/driver-logs?${queryParams.toString()}`;

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
				{ error: (data as { message?: string })?.message || "Failed to fetch driver logs" },
				{ status },
			);
		}

		const payload =
			(data as { data?: DriverLogsApiPayload })?.data ?? (data as DriverLogsApiPayload);
		const logs = Array.isArray(payload?.logs) ? payload.logs : [];
		const pagination = payload?.pagination ?? {
			current_page: page ? Math.max(1, parseInt(page, 10)) : 1,
			per_page: limit ? Math.max(1, parseInt(limit, 10)) : 20,
			total_count: logs.length,
			total_pages: 1,
			has_next_page: false,
			has_prev_page: false,
		};

		return NextResponse.json({ logs, pagination }, { status: 200 });
	} catch (error) {
		const message =
			axios.isAxiosError(error) && error.response?.data
				? String((error.response.data as { error?: string }).error || error.message)
				: error instanceof Error
					? error.message
					: "Internal server error";
		console.error("Error fetching driver logs:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
