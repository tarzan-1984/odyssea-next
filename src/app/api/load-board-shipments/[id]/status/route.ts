import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessLoadBoard } from "@/utils/roleAccess";

function parseBackendError(data: unknown, fallback: string): string {
	const raw =
		data && typeof data === "object"
			? ((data as { message?: unknown; error?: unknown }).message ??
				(data as { error?: unknown }).error)
			: null;
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
						return Object.values(item.constraints as Record<string, string>).join(
							", ",
						);
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
 * PATCH /api/load-board-shipments/:id/status
 * Sets shipment status to posted or unposted.
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
		if (!canAccessLoadBoard(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id: idParam } = await params;
		const id = Number(idParam);
		if (!Number.isFinite(id) || id <= 0) {
			return NextResponse.json({ error: "Invalid shipment id" }, { status: 400 });
		}

		const body = await request.json().catch(() => ({}));
		const status = body?.status;
		if (status !== "posted" && status !== "unposted") {
			return NextResponse.json(
				{ error: "status must be posted or unposted" },
				{ status: 400 },
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/load-board-shipments/${id}/status`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ status }),
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: parseBackendError(data, "Failed to update shipment status") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating load board shipment status:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
