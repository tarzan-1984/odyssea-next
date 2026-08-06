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
 * PATCH /api/load-board-shipments/:id
 * Updates a load_board_shipments row on the backend.
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

		const body = await request.json();
		const route = body?.route;
		const pickupEarliest =
			typeof body?.pickupEarliest === "string" ? body.pickupEarliest.trim() : "";
		const weight = Number(body?.weight);
		const commodity =
			typeof body?.commodity === "string" ? body.commodity.trim() : "";
		const loadType = body?.loadType;
		const equipment = body?.equipment;

		if (!Array.isArray(route) || route.length < 2) {
			return NextResponse.json(
				{ error: "route must be an array with at least two points" },
				{ status: 400 },
			);
		}

		if (!pickupEarliest) {
			return NextResponse.json(
				{ error: "pickupEarliest is required" },
				{ status: 400 },
			);
		}

		if (!Number.isFinite(weight) || weight < 0) {
			return NextResponse.json(
				{ error: "weight must be a valid number" },
				{ status: 400 },
			);
		}

		if (!commodity) {
			return NextResponse.json({ error: "commodity is required" }, { status: 400 });
		}

		if (commodity.length > 100) {
			return NextResponse.json(
				{ error: "commodity must be at most 100 characters" },
				{ status: 400 },
			);
		}

		if (loadType !== "full" && loadType !== "partial") {
			return NextResponse.json(
				{ error: "loadType must be full or partial" },
				{ status: 400 },
			);
		}

		if (
			equipment !== "cargo_van" &&
			equipment !== "box_truck" &&
			equipment !== "dry_van"
		) {
			return NextResponse.json({ error: "Invalid equipment" }, { status: 400 });
		}

		const rateRaw = body?.rate;
		const rate =
			rateRaw != null && rateRaw !== "" ? Number(rateRaw) : undefined;

		const payload = {
			route,
			pickupEarliest,
			pickupLatest:
				typeof body?.pickupLatest === "string" ? body.pickupLatest.trim() : undefined,
			pickupHours:
				typeof body?.pickupHours === "string" ? body.pickupHours.trim() : undefined,
			dropOffHours:
				typeof body?.dropOffHours === "string" ? body.dropOffHours.trim() : undefined,
			weight,
			commodity,
			specialInstructions: Array.isArray(body?.specialInstructions)
				? body.specialInstructions
				: undefined,
			loadType,
			equipment,
			equipmentLength:
				body?.equipmentLength != null && body.equipmentLength !== ""
					? Number(body.equipmentLength)
					: undefined,
			equipmentWeight:
				body?.equipmentWeight != null && body.equipmentWeight !== ""
					? Number(body.equipmentWeight)
					: undefined,
			comments:
				typeof body?.comments === "string" ? body.comments.trim() : undefined,
			referenceId:
				typeof body?.referenceId === "string" ? body.referenceId.trim() : undefined,
			rate: rate != null && Number.isFinite(rate) ? rate : undefined,
			status: body?.status === "unposted" ? "unposted" : body?.status === "posted" ? "posted" : undefined,
		};

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/load-board-shipments/${id}`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(payload),
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: parseBackendError(data, "Failed to update shipment") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating load board shipment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * DELETE /api/load-board-shipments/:id
 * Permanently deletes a load board shipment.
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
		if (!canAccessLoadBoard(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id: idParam } = await params;
		const id = Number(idParam);
		if (!Number.isFinite(id) || id <= 0) {
			return NextResponse.json({ error: "Invalid shipment id" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/load-board-shipments/${id}`,
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
				{ error: parseBackendError(data, "Failed to delete shipment") },
				{ status: response.status },
			);
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error deleting load board shipment:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
