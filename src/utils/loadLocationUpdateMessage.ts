/** Staff template for LOAD chat "Copy Location Update" (blank lines as in the brief). */
export function buildLoadLocationUpdateMessage(
	currentLocation: string,
	milesLeft?: string | null,
): string {
	const lines = [
		"Team,",
		"",
		`Please note that the current location of the unit is ${currentLocation}.`,
	];
	if (milesLeft != null && milesLeft !== "") {
		lines.push("", `Miles left to the receiver: ${milesLeft} miles.`);
	}
	lines.push("", "We will keep you posted.");
	return lines.join("\n");
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
