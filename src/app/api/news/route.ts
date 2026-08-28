import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessNewsUpdates } from "@/utils/roleAccess";

function nestErrorMessage(data: { message?: unknown; error?: unknown }, fallback: string): string {
	const raw = data.message || data.error;
	if (typeof raw === "string") return raw;
	if (Array.isArray(raw)) {
		return (
			raw
				.map((item: unknown) => {
					if (typeof item === "string") return item;
					if (
						item &&
						typeof item === "object" &&
						"constraints" in item &&
						item.constraints &&
						typeof item.constraints === "object"
					) {
						return Object.values(item.constraints as Record<string, string>).join(", ");
					}
					return null;
				})
				.filter(Boolean)
				.join("; ") || fallback
		);
	}
	return fallback;
}

/**
 * GET /api/news
 * Lists recent news articles.
 */
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessNewsUpdates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { searchParams } = new URL(request.url);
		const page = searchParams.get("page") || "1";
		const limit = searchParams.get("limit") || "10";
		const qs = new URLSearchParams({ page, limit });

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/news?${qs.toString()}`,
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
				{ error: nestErrorMessage(data, "Failed to load news") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error loading news:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/news
 * Creates a news article.
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessNewsUpdates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = await request.json();
		const title = typeof body?.title === "string" ? body.title.trim() : "";
		const article = typeof body?.article === "string" ? body.article : "";

		if (!title) {
			return NextResponse.json({ error: "title is required" }, { status: 400 });
		}

		if (!article.trim()) {
			return NextResponse.json({ error: "article is required" }, { status: 400 });
		}

		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/news`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ title, article }),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: nestErrorMessage(data, "Failed to create news") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error creating news:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
