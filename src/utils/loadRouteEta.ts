export type LoadRouteEtaPoint = {
	type: "pick_up_location" | "delivery_location";
	location: string;
	latitude?: number;
	longitude?: number;
	passed: boolean;
};

export type RoadEtaStopKind = "first_pickup" | "pickup" | "delivery";

export type RoadEtaStop = {
	kind: RoadEtaStopKind;
	lat: number;
	lng: number;
	addressLabel: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseFiniteNumber(value: unknown): number | null {
	const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	return Number.isFinite(n) ? n : null;
}

export function parseLoadRoutePoints(value: unknown): LoadRouteEtaPoint[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap(item => {
		const rec = asRecord(item);
		if (!rec) return [];
		const typeRaw = String(rec.type ?? "")
			.trim()
			.toLowerCase()
			.replace(/[\s-]+/g, "_");
		const type =
			typeRaw === "pick_up_location" || typeRaw === "pickup_location"
				? "pick_up_location"
				: typeRaw === "delivery_location"
					? "delivery_location"
					: null;
		if (!type) return [];
		const location = String(rec.location ?? "").trim();
		if (!location) return [];
		const latitude = parseFiniteNumber(rec.latitude);
		const longitude = parseFiniteNumber(rec.longitude);
		return [
			{
				type,
				location,
				passed: rec.passed === true,
				...(latitude != null ? { latitude } : {}),
				...(longitude != null ? { longitude } : {}),
			},
		];
	});
}

export function findNextUnpassedRoutePoint(
	points: LoadRouteEtaPoint[],
	options?: { skipFirstPickup?: boolean }
): RoadEtaStop | null {
	let skippedFirstPickup = !options?.skipFirstPickup;
	for (const point of points) {
		if (!skippedFirstPickup && point.type === "pick_up_location") {
			skippedFirstPickup = true;
			continue;
		}
		if (point.passed) continue;
		const lat = parseFiniteNumber(point.latitude);
		const lng = parseFiniteNumber(point.longitude);
		if (lat == null || lng == null) continue;
		return {
			kind: point.type === "pick_up_location" ? "pickup" : "delivery",
			lat,
			lng,
			addressLabel: point.location,
		};
	}
	return null;
}

export function roadEtaBannerCopy(kind: RoadEtaStopKind): {
	title: string;
	loading: string;
} {
	if (kind === "first_pickup") {
		return {
			title: "Estimated arrival at first pickup",
			loading: "Calculating estimated arrival at pickup…",
		};
	}
	if (kind === "pickup") {
		return {
			title: "Estimated arrival at next pickup",
			loading: "Calculating estimated arrival at pickup…",
		};
	}
	return {
		title: "Estimated arrival at delivery",
		loading: "Calculating estimated arrival at delivery…",
	};
}

export function roadEtaHeaderKindLabel(kind: RoadEtaStopKind): string {
	if (kind === "first_pickup") return "first pickup";
	if (kind === "pickup") return "next pickup";
	return "delivery";
}

export type StoredRoadEta = {
	kind: RoadEtaStopKind;
	arrivalLabel: string;
	remainingMiles: number | null;
	durationSeconds: number | null;
	distanceMeters: number | null;
	lastLocationUpdateAt: string | null;
};

/** Parse load enrichment `roadEta` (same snapshot as the LOAD chat header). */
export function parseStoredRoadEta(value: unknown): StoredRoadEta | null {
	const rec = asRecord(value);
	if (!rec) return null;
	const kindRaw = String(rec.kind ?? "").trim();
	const kind: RoadEtaStopKind | null =
		kindRaw === "first_pickup" || kindRaw === "pickup" || kindRaw === "delivery"
			? kindRaw
			: null;
	const arrivalLabel = String(rec.arrivalLabel ?? "").trim();
	if (!kind || !arrivalLabel) return null;
	const lastLocationUpdateAt = String(rec.lastLocationUpdateAt ?? "").trim();
	return {
		kind,
		arrivalLabel,
		remainingMiles: parseFiniteNumber(rec.remainingMiles),
		durationSeconds: parseFiniteNumber(rec.durationSeconds),
		distanceMeters: parseFiniteNumber(rec.distanceMeters),
		lastLocationUpdateAt: lastLocationUpdateAt || null,
	};
}

/** Stored chat/map ETA is only safe when it was computed from this same location ping. */
export function isStoredRoadEtaFresh(
	stored: { lastLocationUpdateAt?: string | null } | null | undefined,
	driverLastLocationUpdateAt: string | null | undefined
): boolean {
	const storedAt = stored?.lastLocationUpdateAt?.trim() ?? "";
	const driverAt = driverLastLocationUpdateAt?.trim() ?? "";
	return storedAt.length > 0 && storedAt === driverAt;
}
