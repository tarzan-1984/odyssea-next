/** Staff template for LOAD chat "Copy Location Update" (blank lines as in the brief). */
export function buildLoadLocationUpdateMessage(
	currentLocation: string,
	milesLeft: string,
): string {
	return [
		"Team,",
		"",
		`Please note that the current location of the unit is ${currentLocation}.`,
		"",
		`Miles left to the receiver: ${milesLeft} miles.`,
		"",
		"We will keep you posted.",
	].join("\n");
}

export function formatMilesLeftForLocationUpdate(
	remainingMiles: number | null | undefined,
): string {
	if (remainingMiles == null || !Number.isFinite(remainingMiles)) {
		return "N/A";
	}
	return String(Math.round(remainingMiles));
}

export function formatCurrentLocationForUpdate(
	locationLabel: string | null | undefined,
): string {
	const location = locationLabel?.trim();
	return location || "N/A";
}
