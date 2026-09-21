import {
	buildLoadLocationUpdateMessage,
	formatCurrentLocationForUpdate,
	formatMilesLeftForLocationUpdate,
} from "../loadLocationUpdateMessage";

describe("loadLocationUpdateMessage", () => {
	it("builds the staff location update template", () => {
		expect(
			buildLoadLocationUpdateMessage("Smyrna, Georgia, 30080", "16"),
		).toBe(
			[
				"Team,",
				"",
				"Please note that the current location of the unit is Smyrna, Georgia, 30080.",
				"",
				"Miles left to the receiver: 16 miles.",
				"",
				"We will keep you posted.",
			].join("\n"),
		);
	});

	it("omits miles when the driver is busy on another load", () => {
		expect(buildLoadLocationUpdateMessage("Grapevine, TX, 76051", null)).toBe(
			[
				"Team,",
				"",
				"Please note that the current location of the unit is Grapevine, TX, 76051.",
				"",
				"We will keep you posted.",
			].join("\n"),
		);
	});

	it("formats location and miles with N/A fallbacks", () => {
		expect(formatCurrentLocationForUpdate(null)).toBe("N/A");
		expect(formatCurrentLocationForUpdate("  Dallas, TX  ")).toBe("Dallas, TX");
		expect(formatMilesLeftForLocationUpdate(null)).toBe("N/A");
		expect(formatMilesLeftForLocationUpdate(15.6)).toBe("16");
	});
});
