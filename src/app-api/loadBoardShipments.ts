import type { CreateOfferRoutePoint } from "./offers";
import type { EquipmentType, LoadType } from "@/components/LoadBoard/newShipmentConstants";

export type LoadBoardShipmentRoutePoint = CreateOfferRoutePoint;

export type LoadBoardShipmentUser = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	externalId: string | null;
};

export interface LoadBoardShipment {
	id: number;
	userId: string;
	userExternalId: string | null;
	user: LoadBoardShipmentUser | null;
	route: LoadBoardShipmentRoutePoint[];
	pickupEarliest: string;
	pickupLatest: string | null;
	pickupHours: string | null;
	dropOffHours: string | null;
	weight: number;
	commodity: string;
	specialInstructions: string[] | null;
	loadType: LoadType;
	equipment: EquipmentType;
	equipmentLength: number | null;
	equipmentWeight: number | null;
	comments: string | null;
	referenceId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateLoadBoardShipmentPayload {
	route: LoadBoardShipmentRoutePoint[];
	pickupEarliest: string;
	pickupLatest?: string;
	pickupHours?: string;
	dropOffHours?: string;
	weight: number;
	commodity: string;
	specialInstructions?: string[];
	loadType: LoadType;
	equipment: EquipmentType;
	equipmentLength?: number;
	equipmentWeight?: number;
	comments?: string;
	referenceId?: string;
}

export async function createLoadBoardShipment(
	payload: CreateLoadBoardShipmentPayload,
): Promise<LoadBoardShipment> {
	const res = await fetch("/api/load-board-shipments", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		const raw = data?.error ?? data?.message;
		const message =
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
							.join("; ") || "Failed to create shipment"
					: "Failed to create shipment";
		throw new Error(message);
	}

	if (data && typeof data === "object" && "data" in data) {
		return data.data as LoadBoardShipment;
	}

	return data as LoadBoardShipment;
}
