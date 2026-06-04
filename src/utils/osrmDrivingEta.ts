export type LatLng = { lat: number; lng: number };

export type OsrmDrivingLegStats = {
	durationSeconds: number;
	distanceMeters: number;
};

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
		durationSeconds: route.duration,
		distanceMeters: route.distance,
	};
}

const NY_TZ = "America/New_York";

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
