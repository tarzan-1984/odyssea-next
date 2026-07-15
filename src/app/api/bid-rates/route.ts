import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessBidRates } from "@/utils/roleAccess";

/**
 * GET /api/bid-rates
 * Lists bid rates with owner and route (paginated).
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessBidRates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const page = searchParams.get("page") || "1";
		const limit = searchParams.get("limit") || "10";
		const qs = new URLSearchParams({ page, limit });

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates?${qs.toString()}`,
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
				{ error: data.message || data.error || "Failed to load bid rates" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error loading bid rates:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/bid-rates
 * Creates bid_rates row and linked BID chat on backend.
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessBidRates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const broker = typeof body?.broker === "string" ? body.broker.trim() : "";
		const rate = Number(body?.rate);
		const distance = Number(body?.distance);
		const route = body?.route;

		if (!Array.isArray(route) || route.length < 2) {
			return NextResponse.json(
				{ error: "route must be an array with at least two points" },
				{ status: 400 },
			);
		}

		if (!broker) {
			return NextResponse.json({ error: "broker is required" }, { status: 400 });
		}

		if (!Number.isFinite(rate) || rate < 0) {
			return NextResponse.json({ error: "rate must be a valid number" }, { status: 400 });
		}

		if (!Number.isFinite(distance) || distance < 0) {
			return NextResponse.json(
				{ error: "distance must be a valid number" },
				{ status: 400 },
			);
		}

		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/bid-rates`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ route, broker, rate, distance }),
		});

		const data = await response.json();

		if (!response.ok) {
			const raw = data.message || data.error;
			const error =
				typeof raw === "string"
					? raw
					: Array.isArray(raw)
						? raw
								.map((item: unknown) => {
									if (typeof item === "string") return item;
									if (
										item &&
										typeof item === "object" &&
										"constraints" in item &&
										item.constraints &&
										typeof item.constraints === "object"
									) {
										return Object.values(
											item.constraints as Record<string, string>,
										).join(", ");
									}
									return null;
								})
								.filter(Boolean)
								.join("; ") || "Failed to create bid rate"
						: "Failed to create bid rate";
			return NextResponse.json({ error }, { status: response.status });
		}

		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error creating bid rate:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
