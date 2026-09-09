export type LatLng = { lat: number; lng: number };

export type OsrmDrivingLegStats = {
	durationSeconds: number;
	distanceMeters: number;
};

const NY_TZ = "America/New_York";
const METERS_PER_MILE = 1609.34;
/** Door-to-door truck average rarely exceeds this on mixed US routes. */
const TRUCK_MAX_AVERAGE_MPH = 48;

function easternClock(fromInstant: number): { hour: number; isWeekend: boolean } {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: NY_TZ,
		hour: "numeric",
		hour12: false,
		weekday: "short",
	}).formatToParts(new Date(fromInstant));
	let hour = Number(parts.find(part => part.type === "hour")?.value ?? 0);
	if (hour === 24) hour = 0;
	const weekday = parts.find(part => part.type === "weekday")?.value ?? "";
	return { hour, isWeekend: weekday === "Sat" || weekday === "Sun" };
}

function peakTrafficMultiplier(fromInstant: number): number {
	const { hour, isWeekend } = easternClock(fromInstant);
	if (isWeekend) {
		return hour >= 11 && hour < 19 ? 1.22 : 1.12;
	}
	if (hour >= 6 && hour < 10) return 1.65;
	if (hour >= 15 && hour < 19) return 1.6;
	if (hour >= 10 && hour < 15) return 1.3;
	return 1.18;
}

function distanceScaleForTraffic(distanceMiles: number): number {
	if (distanceMiles < 80) return 1;
	if (distanceMiles < 200) return 0.55;
	return 0.25;
}

/**
 * Public OSRM is a car / free-flow profile (no traffic, parkways trucks cannot use).
 * Scale duration for a typical US truck trip.
 */
export function adjustOsrmDurationForTruckEta(
	osrmDurationSeconds: number,
	distanceMeters: number,
	fromInstant = Date.now()
): number {
	if (!Number.isFinite(osrmDurationSeconds) || osrmDurationSeconds <= 0) {
		return osrmDurationSeconds;
	}
	const distanceMiles = Number.isFinite(distanceMeters) ? distanceMeters / METERS_PER_MILE : 0;
	const peak = peakTrafficMultiplier(fromInstant);
	const trafficFactor = 1 + (peak - 1) * distanceScaleForTraffic(distanceMiles);
	const fromOsrm = osrmDurationSeconds * trafficFactor;
	const floorFromDistance =
		distanceMiles > 0 ? (distanceMiles / TRUCK_MAX_AVERAGE_MPH) * 3600 : 0;
	return Math.max(osrmDurationSeconds, fromOsrm, floorFromDistance);
}

/** Road driving leg via OSRM (same service as TrackingDeliveryMap). */
export async function fetchOsrmDrivingLegStats(
	from: LatLng,
	to: LatLng,
	signal?: AbortSignal
): Promise<OsrmDrivingLegStats | null> {
	if (!Number.isFinite(from.lat) || !Number.isFinite(from.lng)) return null;
	if (!Number.isFinite(to.lat) || !Number.isFinite(to.lng)) return null;

	const coordinatesParam = `${from.lng},${from.lat};${to.lng},${to.lat}`;
	const url = new URL(
		`https://router.project-osrm.org/route/v1/driving/${coordinatesParam}`
	);
	url.searchParams.set("overview", "false");

	const response = await fetch(url.toString(), { signal });
	if (!response.ok) return null;

	const data = (await response.json()) as {
		routes?: Array<{ duration?: number; distance?: number }>;
	};
	const route = data.routes?.[0];
	if (
		!route ||
		typeof route.duration !== "number" ||
		typeof route.distance !== "number" ||
		!Number.isFinite(route.duration) ||
		!Number.isFinite(route.distance)
	) {
		return null;
	}

	return {
		durationSeconds: adjustOsrmDurationForTruckEta(route.duration, route.distance),
		distanceMeters: route.distance,
	};
}

export function formatDrivingDuration(seconds: number): string {
	const totalMinutes = Math.max(1, Math.round(seconds / 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours > 0 && minutes > 0) return `${hours} hr ${minutes} min`;
	if (hours > 0) return `${hours} hr`;
	return `${minutes} min`;
}

/** Estimated arrival clock time in Eastern Time. */
export function formatNyEstimatedArrival(durationSeconds: number, fromInstant = Date.now()): string {
	const arrival = new Date(fromInstant + durationSeconds * 1000);
	return new Intl.DateTimeFormat("en-US", {
		timeZone: NY_TZ,
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZoneName: "short",
	}).format(arrival);
}
