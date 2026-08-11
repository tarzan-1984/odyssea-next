import type { CreateOfferRoutePoint } from "./offers";
import type { EquipmentType, LoadType } from "@/components/LoadBoard/newShipmentConstants";

export type LoadBoardShipmentRoutePoint = CreateOfferRoutePoint;
export type LoadBoardShipmentStatus = "posted" | "unposted";
export type LoadBoardLoadStatus =
	| "waiting-on-pu-date"
	| "at-pu"
	| "loaded-enroute"
	| "at-del"
	| "delivered"
	| "tonu"
	| "cancelled"
	| "waiting-on-rc"
	| "draft";
export type LoadBoardAgeSort = "asc" | "desc";

export type LoadBoardShipmentUser = {
	id: string;
	firstName: string | null;
	lastName: string | null;
	externalId: string | null;
};

export interface RateLoadBoard {
	id: number;
	loadBoardId: number;
	driverId: string;
	driverExternalId: string | null;
	rate: number | null;
	driverEta?: string | null;
	actionTime?: number | string | null;
	emptyMiles?: number | null;
	totalMiles?: number | null;
	active: boolean;
	isSelected: boolean;
	createdAt?: string;
	updatedAt?: string;
	driver?: LoadBoardShipmentUser | null;
}

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
	rate: number | null;
	status: LoadBoardShipmentStatus;
	loadStatus?: LoadBoardLoadStatus | null;
	pickupLat?: number | null;
	pickupLng?: number | null;
	/** True when pickup window (latest/earliest + hours) is already in the past (NY). */
	pickupExpired?: boolean;
	createdAt: string;
	updatedAt: string;
	rateLoadBoards?: RateLoadBoard[];
}

export interface LoadBoardShipmentsPagination {
	current_page: number;
	per_page: number;
	total_count: number;
	total_pages: number;
	has_next_page: boolean;
	has_prev_page: boolean;
}

export interface GetLoadBoardShipmentsParams {
	page?: number;
	limit?: number;
	ageSort?: LoadBoardAgeSort;
}

export interface GetLoadBoardShipmentsResponse {
	shipments: LoadBoardShipment[];
	pagination: LoadBoardShipmentsPagination;
	/** Nest response `timestamp` (real UTC ISO) — same clock that wrote created_at. */
	serverTime?: string;
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
	rate?: number;
	status?: LoadBoardShipmentStatus;
}

function parseErrorMessage(data: unknown, fallback: string): string {
	const raw =
		data && typeof data === "object"
			? ((data as { error?: unknown; message?: unknown }).error ??
				(data as { message?: unknown }).message)
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

export async function getLoadBoardShipments(
	params: GetLoadBoardShipmentsParams = {},
): Promise<GetLoadBoardShipmentsResponse> {
	const qs = new URLSearchParams({
		page: String(params.page ?? 1),
		limit: String(params.limit ?? 10),
		ageSort: params.ageSort === "asc" ? "asc" : "desc",
	});
	const res = await fetch(`/api/load-board-shipments?${qs.toString()}`, {
		method: "GET",
		credentials: "include",
		cache: "no-store",
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(parseErrorMessage(data, "Failed to load shipments"));
	}
	// Nest TransformInterceptor: { data: { shipments, pagination }, timestamp, path }.
	const envelope = data && typeof data === "object" ? data : {};
	const payload =
		"data" in envelope && envelope.data != null && typeof envelope.data === "object"
			? envelope.data
			: envelope;
	const serverTime =
		typeof (envelope as { timestamp?: unknown }).timestamp === "string"
			? (envelope as { timestamp: string }).timestamp
			: undefined;
	return {
		shipments: Array.isArray((payload as { shipments?: unknown }).shipments)
			? (payload as { shipments: LoadBoardShipment[] }).shipments
			: [],
		pagination: (payload as { pagination: LoadBoardShipmentsPagination }).pagination,
		serverTime,
	};
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
		throw new Error(parseErrorMessage(data, "Failed to create shipment"));
	}

	if (data && typeof data === "object" && "data" in data) {
		return data.data as LoadBoardShipment;
	}

	return data as LoadBoardShipment;
}

export async function updateLoadBoardShipment(
	id: number,
	payload: CreateLoadBoardShipmentPayload,
): Promise<LoadBoardShipment> {
	const res = await fetch(`/api/load-board-shipments/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		throw new Error(parseErrorMessage(data, "Failed to update shipment"));
	}

	if (data && typeof data === "object" && "data" in data) {
		return data.data as LoadBoardShipment;
	}

	return data as LoadBoardShipment;
}

export async function updateLoadBoardShipmentStatus(
	id: number,
	status: LoadBoardShipmentStatus,
): Promise<LoadBoardShipment> {
	const res = await fetch(`/api/load-board-shipments/${id}/status`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ status }),
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		throw new Error(parseErrorMessage(data, "Failed to update shipment status"));
	}

	if (data && typeof data === "object" && "data" in data) {
		return data.data as LoadBoardShipment;
	}

	return data as LoadBoardShipment;
}

export async function deleteLoadBoardShipment(id: number): Promise<{ id: number }> {
	const res = await fetch(`/api/load-board-shipments/${id}`, {
		method: "DELETE",
		credentials: "include",
	});

	const data = await res.json().catch(() => ({}));

	if (!res.ok) {
		throw new Error(parseErrorMessage(data, "Failed to delete shipment"));
	}

	if (data && typeof data === "object" && "data" in data) {
		return data.data as { id: number };
	}

	return data as { id: number };
}
