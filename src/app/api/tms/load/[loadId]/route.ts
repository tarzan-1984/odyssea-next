import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL_TMS ?? "").replace(/\/$/, "");
const TMS_LOAD_BASE_URL = `${TMS_BASE_URL}/v1/load`;
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

/** Nest TransformInterceptor wraps as { data, timestamp, path }. TMS body is { success, data: { meta_data } }. */
function unwrapTmsLoadDetails(body: unknown): Record<string, unknown> | null {
	if (!body || typeof body !== "object") return null;

	let current = body as Record<string, unknown>;
	for (let i = 0; i < 4; i++) {
		const inner = current.data;
		if (!inner || typeof inner !== "object" || Array.isArray(inner)) break;
		const rec = inner as Record<string, unknown>;
		if ("meta_data" in rec || "shippers" in rec) {
			return { success: true, data: rec };
		}
		current = rec;
	}

	if ("meta_data" in current || "shippers" in current) {
		return { success: true, data: current };
	}

	return null;
}

async function fetchLoadDetailsFromDatabase(
	loadId: string,
	accessToken: string
): Promise<Record<string, unknown> | null> {
	const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/loads/${encodeURIComponent(loadId.trim())}/tms-details`;

	const response = await fetch(backendUrl, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		cache: "no-store",
	});

	if (response.status === 404) {
		return null;
	}

	const data = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(
			(data as { message?: string })?.message ||
				(data as { error?: string })?.error ||
				`Failed to load details from database: ${response.status}`
		);
	}

	return unwrapTmsLoadDetails(data);
}

async function fetchLoadDetailsFromTms(loadId: string): Promise<unknown> {
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
		throw new Error(
			(data as { message?: string })?.message ||
				"Failed to get load details from TMS"
		);
	}

	const unwrapped = unwrapTmsLoadDetails(data);
	if (!unwrapped) {
		throw new Error("TMS returned empty load data");
	}

	return unwrapped;
}

// GET /api/tms/load/[loadId] — DB first, then TMS fallback.
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
) {
	const { loadId } = await params;

	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load ID is required" }, { status: 400 });
		}

		if (accessToken) {
			try {
				const fromDb = await fetchLoadDetailsFromDatabase(loadId, accessToken);
				if (fromDb) {
					return NextResponse.json(fromDb, { status: 200 });
				}
			} catch (error) {
				console.warn(
					`[api/tms/load/${loadId}] DB lookup failed, falling back to TMS:`,
					error
				);
			}
		}

		const fromTms = await fetchLoadDetailsFromTms(loadId);
		return NextResponse.json(fromTms, { status: 200 });
	} catch (error) {
		console.error("Error getting TMS load details:", error);
		const message =
			error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
