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

/** How far a farther route leg can be and still tie with the closest leg. */
const ROUTE_SEGMENT_SNAP_MILES = 25;
const EARTH_RADIUS_MILES = 3958.7613;

export type RoadEtaDriverPosition = { lat: number; lng: number };

function haversineMiles(a: RoadEtaDriverPosition, b: RoadEtaDriverPosition): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function distanceToRouteSegmentMiles(
	driver: RoadEtaDriverPosition,
	start: RoadEtaDriverPosition,
	end: RoadEtaDriverPosition
): number {
	const meanLat = ((start.lat + end.lat + driver.lat) / 3) * (Math.PI / 180);
	const milesPerDegLat = 69.172;
	const milesPerDegLng = Math.cos(meanLat) * milesPerDegLat;
	const bx = (end.lng - start.lng) * milesPerDegLng;
	const by = (end.lat - start.lat) * milesPerDegLat;
	const dx = (driver.lng - start.lng) * milesPerDegLng;
	const dy = (driver.lat - start.lat) * milesPerDegLat;
	const lengthSquared = bx * bx + by * by;
	if (lengthSquared < 1e-6) return haversineMiles(driver, start);
	const t = Math.max(0, Math.min(1, (dx * bx + dy * by) / lengthSquared));
	return haversineMiles(driver, {
		lat: start.lat + (end.lat - start.lat) * t,
		lng: start.lng + (end.lng - start.lng) * t,
	});
}

function pointLatLng(point: LoadRouteEtaPoint): RoadEtaDriverPosition | null {
	const lat = parseFiniteNumber(point.latitude);
	const lng = parseFiniteNumber(point.longitude);
	if (lat == null || lng == null) return null;
	return { lat, lng };
}

/**
 * Index of the next stop on the route leg the driver is actually on.
 * The 1.5 mile geofence can miss a dock, so an earlier delivery stays
 * unmarked while the truck is already heading to a later stop.
 */
function routeProgressTargetIndex(
	points: LoadRouteEtaPoint[],
	driver: RoadEtaDriverPosition | null
): number {
	if (!driver) return 0;
	const anchors: Array<{ index: number; at: RoadEtaDriverPosition }> = [];
	points.forEach((point, index) => {
		const at = pointLatLng(point);
		if (at) anchors.push({ index, at });
	});
	if (anchors.length < 2) return anchors[0]?.index ?? 0;

	const segmentMiles = anchors.slice(0, -1).map((anchor, index) =>
		distanceToRouteSegmentMiles(driver, anchor.at, anchors[index + 1].at)
	);
	const closestMiles = Math.min(...segmentMiles);
	const threshold = closestMiles + ROUTE_SEGMENT_SNAP_MILES;
	for (let index = 0; index < segmentMiles.length; index += 1) {
		if (segmentMiles[index] <= threshold) return anchors[index + 1].index;
	}
	return anchors[anchors.length - 1].index;
}

function stopFromPoint(point: LoadRouteEtaPoint, at: RoadEtaDriverPosition): RoadEtaStop {
	return {
		kind: point.type === "pick_up_location" ? "pickup" : "delivery",
		lat: at.lat,
		lng: at.lng,
		addressLabel: point.location,
	};
}

/** First stop the driver has not reached yet. */
export function findNextUnpassedRoutePoint(
	points: LoadRouteEtaPoint[],
	options?: { skipFirstPickup?: boolean; driver?: RoadEtaDriverPosition | null }
): RoadEtaStop | null {
	const driver =
		options?.driver &&
		Number.isFinite(options.driver.lat) &&
		Number.isFinite(options.driver.lng)
			? options.driver
			: null;
	const startIndex = routeProgressTargetIndex(points, driver);
	let skippedFirstPickup = !options?.skipFirstPickup;
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		const skipThisPickup = !skippedFirstPickup && point.type === "pick_up_location";
		if (skipThisPickup) skippedFirstPickup = true;
		if (index < startIndex || skipThisPickup) continue;
		if (point.passed) continue;
		const at = pointLatLng(point);
		if (!at) continue;
		return stopFromPoint(point, at);
	}
	return null;
}

/**
 * Stored chat ETA is for one stop. Reject it when the road distance cannot
 * be the drive to the stop we just selected (driver already passed it).
 */
export function storedRoadEtaMatchesStop(
	stored: { distanceMeters?: number | null } | null | undefined,
	driver: RoadEtaDriverPosition | null | undefined,
	stop: { lat: number; lng: number } | null | undefined
): boolean {
	if (!stored || !driver || !stop) return false;
	const roadMeters = stored.distanceMeters;
	if (roadMeters == null || !Number.isFinite(roadMeters) || roadMeters < 0) return false;
	const straightMiles = haversineMiles(driver, stop);
	const straightMeters = straightMiles * 1609.34;
	if (straightMeters < 1609.34) return roadMeters <= 80 * 1609.34;
	const ratio = roadMeters / straightMeters;
	return ratio >= 0.75 && ratio <= 2.5;
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
