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
		return raw.filter((item): item is string => typeof item === "string").join("; ") || fallback;
	}
	return fallback;
}

/**
 * DELETE /api/load-board-shipments/:id/bids/:driverId
 * Removes a driver bid (sets active = false).
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; driverId: string }> },
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

		const { id: idParam, driverId } = await params;
		const id = Number(idParam);
		if (!Number.isFinite(id) || id <= 0 || !driverId?.trim()) {
			return NextResponse.json({ error: "Invalid shipment or driver id" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/load-board-shipments/${id}/bids/${encodeURIComponent(driverId)}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${accessToken}` },
			},
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: parseBackendError(data, "Failed to remove driver bid") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error removing load board driver bid:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
