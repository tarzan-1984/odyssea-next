import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";
import { canAccessAppLogs, canViewOfferLogRates } from "@/utils/roleAccess";

type OfferLogsApiPayload = {
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
 * GET /api/offers-logs?page=&limit=&driver_external_id=&offer_id=&date_from=&date_to=
 * Proxies to NestJS offers_logs list.
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
		const driverExternalId = searchParams.get("driver_external_id");
		const offerId = searchParams.get("offer_id");
		const dateFrom = searchParams.get("date_from");
		const dateTo = searchParams.get("date_to");
		if (page) queryParams.set("page", page);
		if (limit) queryParams.set("limit", limit);
		if (driverExternalId && driverExternalId.trim() !== "") {
			queryParams.set("driver_external_id", driverExternalId.trim());
		}
		if (offerId && offerId.trim() !== "") {
			queryParams.set("offer_id", offerId.trim());
		}
		if (dateFrom && dateFrom.trim() !== "") {
			queryParams.set("date_from", dateFrom.trim());
		}
		if (dateTo && dateTo.trim() !== "") {
			queryParams.set("date_to", dateTo.trim());
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers-logs?${queryParams.toString()}`;

		const response = await axios.get(url, {
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			validateStatus: () => true,
		});

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			const body = data as { message?: string | string[] };
			const message = Array.isArray(body?.message)
				? body.message.join(", ")
				: body?.message || "Failed to fetch offer logs";
			return NextResponse.json({ error: message }, { status });
		}

		const payload =
			(data as { data?: OfferLogsApiPayload })?.data ?? (data as OfferLogsApiPayload);
		const logs = Array.isArray(payload?.logs) ? payload.logs : [];
		if (!canViewOfferLogRates(userData?.role)) {
			for (const log of logs) {
				if (log && typeof log === "object") {
					delete (log as { rates?: unknown }).rates;
				}
			}
		}
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
		console.error("Error fetching offer logs:", error);
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
