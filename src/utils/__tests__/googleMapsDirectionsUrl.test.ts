import { buildGoogleMapsDirectionsUrl } from "../googleMapsDirectionsUrl";

describe("buildGoogleMapsDirectionsUrl", () => {
	it("stays empty until every stop location is filled", () => {
		expect(buildGoogleMapsDirectionsUrl(["Coppell, TX 75019"])).toBeNull();
		expect(buildGoogleMapsDirectionsUrl(["Coppell, TX 75019", ""])).toBeNull();
		expect(
			buildGoogleMapsDirectionsUrl(["Coppell, TX 75019", "   ", "New York, NY 10007"])
		).toBeNull();
	});

	it("builds a direct route for pickup and delivery", () => {
		expect(
			buildGoogleMapsDirectionsUrl(["Coppell, TX 75019", "New York, NY 10007"])
		).toBe(
			"https://www.google.com/maps/dir/?api=1&origin=Coppell%2C+TX+75019&destination=New+York%2C+NY+10007&travelmode=driving"
		);
	});

	it("keeps intermediate stops in order", () => {
		const url = buildGoogleMapsDirectionsUrl([
			"Coppell, TX 75019",
			"Chicago, IL 60601",
			"Cleveland, OH 44113",
			"New York, NY 10007",
		]);
		expect(url).toBe(
			"https://www.google.com/maps/dir/?api=1&origin=Coppell%2C+TX+75019&destination=New+York%2C+NY+10007&travelmode=driving&waypoints=Chicago%2C%20IL%2060601|Cleveland%2C%20OH%2044113"
		);
	});

	it("includes every stop when there are more than 9 waypoints", () => {
		const stops = Array.from({ length: 12 }, (_, index) => `Stop ${index + 1}`);
		const url = buildGoogleMapsDirectionsUrl(stops);
		expect(url).toBe(
			`https://www.google.com/maps/dir/${stops.map(stop => encodeURIComponent(stop)).join("/")}?travelmode=driving`
		);
	});
});
