import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { serverAuth } from "@/utils/auth";

const TMS_DRIVER_RATINGS_URL =
	"https://www.endurance-tms.com/wp-json/tms/v1/driver/ratings";
const TMS_DRIVER_RATING_URL =
	"https://www.endurance-tms.com/wp-json/tms/v1/driver/rating";
const TMS_API_KEY = process.env.TMS_API_KEY || "tms_api_key_2024_driver_access";

/**
 * GET /api/users/drivers/ratings
 * Proxies to TMS driver ratings API.
 * Query params: driver_id, user_id (required), per_page, page
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
		const userId = searchParams.get("user_id");
		const perPage = searchParams.get("per_page") || "10";
		const page = searchParams.get("page") || "1";

		if (!driverId || !userId) {
			return NextResponse.json(
				{ error: "driver_id and user_id are required" },
				{ status: 400 }
			);
		}

		const url = `${TMS_DRIVER_RATINGS_URL}?driver_id=${encodeURIComponent(driverId)}&user_id=${encodeURIComponent(userId)}&per_page=${encodeURIComponent(perPage)}&page=${encodeURIComponent(page)}`;

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
				{
					error:
						(data as { message?: string })?.message ||
						"Failed to fetch driver ratings",
				},
				{ status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching driver ratings:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/users/drivers/ratings
 * Proxies to TMS driver rating API (create rating).
 * Body: { driver_id, user_id, rating, load_number, comments? }
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
		const userId = body?.user_id;
		const rating = body?.rating;
		const loadNumber = body?.load_number;
		const comments = body?.comments ?? "";

		if (driverId == null || userId == null) {
			return NextResponse.json(
				{ error: "driver_id and user_id are required" },
				{ status: 400 }
			);
		}
		if (rating == null || Number.isNaN(Number(rating))) {
			return NextResponse.json(
				{ error: "rating is required" },
				{ status: 400 }
			);
		}
		if (typeof loadNumber !== "string" || !loadNumber.trim()) {
			return NextResponse.json(
				{ error: "load_number is required" },
				{ status: 400 }
			);
		}

		const response = await axios.post(
			TMS_DRIVER_RATING_URL,
			{
				driver_id: Number(driverId),
				user_id: Number(userId),
				rating: Number(rating),
				load_number: loadNumber.trim(),
				comments: typeof comments === "string" ? comments.trim() : "",
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
			const root = data as Record<string, unknown> | null;
			const nested =
				root?.data && typeof root.data === "object" && !Array.isArray(root.data)
					? (root.data as Record<string, unknown>)
					: null;
			const message =
				(typeof root?.error === "string" && root.error) ||
				(typeof root?.message === "string" && root.message) ||
				(typeof nested?.message === "string" && nested.message) ||
				"Failed to create driver rating";
			return NextResponse.json({ error: message }, { status });
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error creating driver rating:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
