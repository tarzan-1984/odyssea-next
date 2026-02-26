import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_DRIVER_NOTES_URL =
	"https://www.endurance-tms.com/wp-json/tms/v1/driver/notes";
const TMS_DRIVER_NOTICE_URL =
	"https://www.endurance-tms.com/wp-json/tms/v1/driver/notice";
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

/**
 * GET /api/users/drivers/notes
 * Proxies to TMS driver notes API.
 * Query params: driver_id (required), per_page (default 20), page (default 1)
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			);
		}

		const { searchParams } = new URL(request.url);
		const driverId = searchParams.get("driver_id");
		const perPage = searchParams.get("per_page") || "20";
		const page = searchParams.get("page") || "1";

		if (!driverId) {
			return NextResponse.json(
				{ error: "driver_id is required" },
				{ status: 400 }
			);
		}

		const url = `${TMS_DRIVER_NOTES_URL}?driver_id=${encodeURIComponent(driverId)}&per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}`;

		const response = await axios.get(url, {
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": TMS_API_KEY,
			},
			validateStatus: () => true,
		});

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{ error: (data as { message?: string })?.message || "Failed to fetch driver notes" },
				{ status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching driver notes:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/users/drivers/notes
 * Proxies to TMS driver notice API (create notice).
 * Body: { driver_id: number, id_user: number, message: string }
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			);
		}

		const body = await request.json();
		const driverId = body?.driver_id;
		const idUser = body?.id_user;
		const message = body?.message;

		if (driverId == null || idUser == null) {
			return NextResponse.json(
				{ error: "driver_id and id_user are required" },
				{ status: 400 }
			);
		}
		if (typeof message !== "string" || !message.trim()) {
			return NextResponse.json(
				{ error: "message is required and must be non-empty" },
				{ status: 400 }
			);
		}

		const response = await axios.post(
			TMS_DRIVER_NOTICE_URL,
			{
				driver_id: Number(driverId),
				id_user: Number(idUser),
				message: message.trim(),
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": TMS_API_KEY,
				},
				validateStatus: () => true,
			}
		);

		const { data, status } = response;

		if (status < 200 || status >= 300) {
			return NextResponse.json(
				{
					error: (data as { message?: string })?.message || "Failed to create driver notice",
				},
				{ status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error creating driver notice:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
