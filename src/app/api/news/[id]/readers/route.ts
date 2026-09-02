import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessNewsUpdates } from "@/utils/roleAccess";

/**
 * GET /api/news/:id/readers
 * Lists users who opened the news article.
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessNewsUpdates(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await params;
		const newsId = Number(id);
		if (!Number.isFinite(newsId) || newsId <= 0) {
			return NextResponse.json({ error: "Invalid news id" }, { status: 400 });
		}

		const { searchParams } = new URL(request.url);
		const page = searchParams.get("page") || "1";
		const limit = searchParams.get("limit") || "50";
		const search = searchParams.get("search") || "";
		const qs = new URLSearchParams({ page, limit });
		if (search.trim()) {
			qs.set("search", search.trim());
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/news/${newsId}/readers?${qs.toString()}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to load readers" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error loading news readers:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
