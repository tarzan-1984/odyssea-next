import { adjustOsrmDurationForTruckEta } from "../osrmDrivingEta";

describe("adjustOsrmDurationForTruckEta", () => {
	it("adds weekday AM peak slack for a short regional truck trip", () => {
		// Wed 2026-09-09 08:00 EDT
		const morning = Date.parse("2026-09-09T12:00:00.000Z");
		const osrmSeconds = 65 * 60;
		const distanceMeters = 43.4 * 1609.34;
		const adjusted = adjustOsrmDurationForTruckEta(osrmSeconds, distanceMeters, morning);
		expect(adjusted).toBeCloseTo(osrmSeconds * 1.65, 0);
		expect(adjusted / 60).toBeGreaterThan(100);
	});

	it("does not apply full peak factor on a long interstate haul", () => {
		const morning = Date.parse("2026-09-09T12:00:00.000Z");
		const osrmSeconds = 8 * 3600;
		const distanceMeters = 500 * 1609.34;
		const adjusted = adjustOsrmDurationForTruckEta(osrmSeconds, distanceMeters, morning);
		const trafficAdjusted = osrmSeconds * (1 + 0.65 * 0.25);
		const distanceFloor = (500 / 48) * 3600;
		expect(adjusted).toBeCloseTo(Math.max(trafficAdjusted, distanceFloor), 0);
		expect(adjusted / osrmSeconds).toBeLessThan(1.4);
	});
});
