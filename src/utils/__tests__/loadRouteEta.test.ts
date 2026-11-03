import {
	findNextUnpassedRoutePoint,
	storedRoadEtaMatchesStop,
	type LoadRouteEtaPoint,
} from "../loadRouteEta";

const route: LoadRouteEtaPoint[] = [
	{
		type: "pick_up_location",
		location: "Standish, MI 48658",
		latitude: 43.98219,
		longitude: -83.97765,
		passed: true,
	},
	{
		type: "delivery_location",
		location: "Georgetown, KY 40324",
		latitude: 38.26148,
		longitude: -84.53255,
		passed: false,
	},
	{
		type: "delivery_location",
		location: "Huntsville, AL 35810",
		latitude: 34.76102,
		longitude: -86.59911,
		passed: false,
	},
];

const driver = { lat: 35.578465, lng: -86.904431 };

describe("findNextUnpassedRoutePoint", () => {
	it("selects the later delivery when the truck is already on that leg", () => {
		const stop = findNextUnpassedRoutePoint(route, {
			skipFirstPickup: true,
			driver,
		});
		expect(stop?.addressLabel).toContain("Huntsville");
	});

	it("rejects a stored ETA computed for a stop the driver has left behind", () => {
		const stop = findNextUnpassedRoutePoint(route, {
			skipFirstPickup: true,
			driver,
		});
		expect(
			storedRoadEtaMatchesStop(
				{ distanceMeters: 448283 },
				driver,
				stop
			)
		).toBe(false);
	});
});
