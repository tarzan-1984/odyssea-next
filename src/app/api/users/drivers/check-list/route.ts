import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

type CheckListApiPayload = {
	drivers: unknown[];
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
 * GET /api/users/drivers/check-list?page=&limit=
 * Proxies to NestJS drivers check-list (ACTIVE, statuses, location stale 3h NY).
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const queryParams = new URLSearchParams();
		const page = searchParams.get("page");
		const limit = searchParams.get("limit");
		const driverStatus = searchParams.get("driverStatus");
		if (page) queryParams.set("page", page);
		if (limit) queryParams.set("limit", limit);
		if (driverStatus && driverStatus.trim() !== "") {
			queryParams.set("driverStatus", driverStatus.trim());
		}
		const search = searchParams.get("search");
		if (search && search.trim() !== "") {
			queryParams.set("search", search.trim());
		}
		const sortParam = searchParams.get("lastLocationSort")?.trim().toLowerCase();
		if (sortParam === "desc" || sortParam === "asc") {
			queryParams.set("lastLocationSort", sortParam);
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/drivers/check-list?${queryParams.toString()}`;

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
				{ error: (data as { message?: string })?.message || "Failed to fetch check list" },
				{ status }
			);
		}

		const payload =
			(data as { data?: CheckListApiPayload })?.data ?? (data as CheckListApiPayload);
		const drivers = Array.isArray(payload?.drivers) ? payload.drivers : [];
		const pagination = payload?.pagination ?? {
			current_page: page ? Math.max(1, parseInt(page, 10)) : 1,
			per_page: limit ? Math.max(1, parseInt(limit, 10)) : 10,
			total_count: drivers.length,
			total_pages: 1,
			has_next_page: false,
			has_prev_page: false,
		};

		return NextResponse.json({ drivers, pagination }, { status: 200 });
	} catch (error) {
		const message =
			axios.isAxiosError(error) && error.response?.data
				? String((error.response.data as { error?: string }).error || error.message)
				: error instanceof Error
					? error.message
					: "Internal server error";
		console.error("Error fetching drivers check list:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
