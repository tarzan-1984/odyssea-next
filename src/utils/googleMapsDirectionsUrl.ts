/** Google Maps URLs API accepts at most 9 intermediate waypoints. */
const GOOGLE_MAPS_MAX_WAYPOINTS = 9;

/**
 * Driving directions for every stop, in route order.
 * Returns null until each stop location is filled (origin and destination at minimum).
 * Opens the same sequence the dispatcher entered, including intermediate stops.
 */
export function buildGoogleMapsDirectionsUrl(locations: string[]): string | null {
	const stops = locations.map(location => location.trim());
	if (stops.length < 2 || stops.some(stop => stop === "")) return null;

	const origin = stops[0];
	const destination = stops[stops.length - 1];
	const waypoints = stops.slice(1, -1);

	// Path form keeps every stop when there are more waypoints than the URL API allows.
	if (waypoints.length > GOOGLE_MAPS_MAX_WAYPOINTS) {
		const path = stops.map(stop => encodeURIComponent(stop)).join("/");
		return `https://www.google.com/maps/dir/${path}?travelmode=driving`;
	}

	const params = new URLSearchParams({
		api: "1",
		origin,
		destination,
		travelmode: "driving",
	});
	let url = `https://www.google.com/maps/dir/?${params.toString()}`;
	if (waypoints.length > 0) {
		// Leave "|" unencoded so Maps splits intermediate stops.
		url += `&waypoints=${waypoints.map(stop => encodeURIComponent(stop)).join("|")}`;
	}
	return url;
}
