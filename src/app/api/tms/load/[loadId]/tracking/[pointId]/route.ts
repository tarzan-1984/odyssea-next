import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canEditLoadTrackingHistory } from "@/utils/roleAccess";

// PATCH /api/tms/load/[loadId]/tracking/[pointId] - update coordinates of one load history point.
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string; pointId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canEditLoadTrackingHistory(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { loadId, pointId } = await params;

		if (!loadId || !pointId) {
			return NextResponse.json(
				{ error: "Load ID and point ID are required" },
				{ status: 400 }
			);
		}

		const body = await request.json().catch(() => null);
		const latitude = Number(body?.latitude);
		const longitude = Number(body?.longitude);
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return NextResponse.json(
				{ error: "latitude and longitude must be valid numbers" },
				{ status: 400 }
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/tms/load/${encodeURIComponent(loadId)}/tracking/${encodeURIComponent(pointId)}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ latitude, longitude }),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to update tracking point" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error updating TMS load tracking point:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

// DELETE /api/tms/load/[loadId]/tracking/[pointId] - delete one load history point.
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string; pointId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canEditLoadTrackingHistory(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { loadId, pointId } = await params;

		if (!loadId || !pointId) {
			return NextResponse.json(
				{ error: "Load ID and point ID are required" },
				{ status: 400 }
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/tms/load/${encodeURIComponent(loadId)}/tracking/${encodeURIComponent(pointId)}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to delete tracking point" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error deleting TMS load tracking point:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
