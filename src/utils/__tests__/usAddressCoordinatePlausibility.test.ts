import {
	coordinatesPlausibleForLocation,
	parseUsStateFromAddress,
} from "../usAddressCoordinatePlausibility";

describe("usAddressCoordinatePlausibility", () => {
	it("rejects Anaheim coordinates for a New Orleans address", () => {
		expect(parseUsStateFromAddress("900 CONVENTION WAY, New Orleans, LA 70130")).toBe("LA");
		expect(
			coordinatesPlausibleForLocation(
				33.79795,
				-117.92124,
				"900 CONVENTION WAY, New Orleans, LA 70130"
			)
		).toBe(false);
		expect(
			coordinatesPlausibleForLocation(
				29.9561,
				-90.0734,
				"900 CONVENTION WAY, New Orleans, LA 70130"
			)
		).toBe(true);
	});
});
