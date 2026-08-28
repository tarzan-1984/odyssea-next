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
 * PATCH /api/news/:id
 * Updates a news article.
 */
export async function PATCH(
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

		const body = await request.json();
		const title = typeof body?.title === "string" ? body.title.trim() : "";
		const article = typeof body?.article === "string" ? body.article : "";

		if (!title) {
			return NextResponse.json({ error: "title is required" }, { status: 400 });
		}

		if (!article.trim()) {
			return NextResponse.json({ error: "article is required" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/news/${newsId}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ title, article }),
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: nestErrorMessage(data, "Failed to update news") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating news:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE /api/news/:id
 * Deletes a news article.
 */
export async function DELETE(
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

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/news/${newsId}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to delete news" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		console.error("Error deleting news:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
