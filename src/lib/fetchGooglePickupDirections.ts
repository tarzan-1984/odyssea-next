export type GooglePickupRoute = {
	durationSeconds: number;
	distanceMeters: number;
	durationText: string | null;
	distanceText: string | null;
	routeLabel: string | null;
	trafficNotice: string | null;
	tollNotice: string | null;
	hasTolls: boolean;
	avoidsTraffic: boolean;
	estimatedArrivalAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function parseBestRoute(raw: unknown): GooglePickupRoute | null {
	const route = asRecord(raw);
	if (!route) return null;
	const durationSeconds = Number(route.durationSeconds);
	const distanceMeters = Number(route.distanceMeters);
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
	if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
	return {
		durationSeconds,
		distanceMeters,
		durationText: typeof route.durationText === "string" ? route.durationText : null,
		distanceText: typeof route.distanceText === "string" ? route.distanceText : null,
		routeLabel: typeof route.routeLabel === "string" ? route.routeLabel : null,
		trafficNotice: typeof route.trafficNotice === "string" ? route.trafficNotice : null,
		tollNotice: typeof route.tollNotice === "string" ? route.tollNotice : null,
		hasTolls: route.hasTolls === true,
		avoidsTraffic: route.avoidsTraffic === true,
		estimatedArrivalAt: null,
	};
}

function unwrapDirectionsPayload(body: unknown): GooglePickupRoute | null {
	let current = asRecord(body);
	for (let i = 0; i < 4 && current; i++) {
		const best = parseBestRoute(current.bestRoute);
		if (best) {
			const arrival =
				typeof current.estimatedArrivalAt === "string" ? current.estimatedArrivalAt : null;
			return { ...best, estimatedArrivalAt: arrival };
		}
		current = asRecord(current.data);
	}
	return null;
}

export function parseGoogleDirectionsBody(body: unknown): GooglePickupRoute | null {
	return unwrapDirectionsPayload(body);
}

export type GoogleDirectionsOrigin = { lat: number; lng: number } | string;

export function buildGoogleDirectionsQuery(
	origin: GoogleDirectionsOrigin,
	destinations: string[]
): URLSearchParams {
	const qs =
		typeof origin === "string"
			? new URLSearchParams({ origin: origin.trim() })
			: new URLSearchParams({
					originLat: String(origin.lat),
					originLng: String(origin.lng),
				});
	const cleaned = destinations.map(item => item.trim()).filter(item => item.length >= 3);
	if (cleaned.length === 1) {
		qs.set("destination", cleaned[0]);
		return qs;
	}
	for (const item of cleaned) {
		qs.append("destinations", item);
	}
	return qs;
}

export async function fetchGooglePickupDirections(
	origin: GoogleDirectionsOrigin,
	destination: string | string[],
	signal?: AbortSignal
): Promise<GooglePickupRoute | null> {
	const destinations = (Array.isArray(destination) ? destination : [destination])
		.map(item => item.trim())
		.filter(item => item.length >= 3);
	if (destinations.length === 0) return null;

	const qs = buildGoogleDirectionsQuery(origin, destinations);
	const response = await fetch(`/api/geocoding/google/directions?${qs.toString()}`, {
		method: "GET",
		signal,
		cache: "no-store",
	});
	if (!response.ok) return null;

	const body: unknown = await response.json().catch(() => null);
	return parseGoogleDirectionsBody(body);
}
