import {
	applyGoogleWaypointsToLocations,
	enrichStopsWithPostal,
	mergeChunkedWaypoints,
	parseGoogleResolvedPlace,
	resolveStopFromGoogleWaypoint,
} from "../offerGoogleRoute";
import {
	LOCATION_GEOCODE_ERROR,
	formatLocationZipMismatchError,
} from "../offerLocationFormat";

describe("parseGoogleResolvedPlace", () => {
	it("keeps city/state/ZIP and drops the street", () => {
		expect(
			parseGoogleResolvedPlace("4926 Harford Rd, Baltimore, MD 21214, USA"),
		).toEqual({
			city: "Baltimore",
			regionCode: "MD",
			postal: "21214",
		});
	});

	it("parses a city line without a street", () => {
		expect(parseGoogleResolvedPlace("College Park, GA 30337, USA")).toEqual({
			city: "College Park",
			regionCode: "GA",
			postal: "30337",
		});
	});

	it("uses the ZIP hint when the address has no postal", () => {
		expect(parseGoogleResolvedPlace("Baltimore, MD, USA", "21214")).toEqual({
			city: "Baltimore",
			regionCode: "MD",
			postal: "21214",
		});
	});

	it("parses Google city + full state name without a ZIP", () => {
		expect(parseGoogleResolvedPlace("Milwaukee, Wisconsin")).toEqual({
			city: "Milwaukee",
			regionCode: "WI",
			postal: null,
		});
		expect(parseGoogleResolvedPlace("Naples, Florida")).toEqual({
			city: "Naples",
			regionCode: "FL",
			postal: null,
		});
	});
});

describe("resolveStopFromGoogleWaypoint", () => {
	const atlantaAirport = {
		resolvedAddress: "6000 N Terminal Pkwy, Atlanta, GA 30337, USA",
		latitude: 33.6407,
		longitude: -84.4277,
		zipCode: "30337",
	};

	it("keeps College Park when ZIP 30337 is in Georgia", () => {
		expect(resolveStopFromGoogleWaypoint("College Park, GA 30337", atlantaAirport)).toEqual({
			location: "College Park, GA 30337",
			latitude: 33.6407,
			longitude: -84.4277,
			zipCode: "30337",
			error: null,
		});
	});

	it("adds ZIP when the user typed only city and state", () => {
		expect(resolveStopFromGoogleWaypoint("Baltimore, MD", {
			resolvedAddress: "4926 Harford Rd, Baltimore, MD 21214, USA",
			latitude: 39.3471,
			longitude: -76.5662,
			zipCode: "21214",
		})).toEqual({
			location: "Baltimore, MD 21214",
			latitude: 39.3471,
			longitude: -76.5662,
			zipCode: "21214",
			error: null,
		});
	});

	it("accepts Milwaukee, WI when Google returns the full state name and no ZIP", () => {
		expect(
			resolveStopFromGoogleWaypoint("Milwaukee, WI", {
				resolvedAddress: "Milwaukee, Wisconsin",
				latitude: 43.0410344,
				longitude: -87.9096783,
				zipCode: null,
			}),
		).toEqual({
			location: "Milwaukee, WI",
			latitude: 43.0410344,
			longitude: -87.9096783,
			zipCode: null,
			error: null,
		});
	});

	it("keeps coords when Google omits ZIP so it can be filled later", () => {
		expect(
			resolveStopFromGoogleWaypoint("Amarillo, TX", {
				resolvedAddress: "Amarillo, TX, USA",
				latitude: 35.222,
				longitude: -101.8313,
				zipCode: null,
			}),
		).toEqual({
			location: "Amarillo, TX",
			latitude: 35.222,
			longitude: -101.8313,
			zipCode: null,
			error: null,
		});
	});

	it("rejects a ZIP that belongs to another state", () => {
		expect(resolveStopFromGoogleWaypoint("College Park, MD 30337", atlantaAirport)).toEqual({
			location: "College Park, MD 30337",
			latitude: null,
			longitude: null,
			zipCode: null,
			error: formatLocationZipMismatchError({
				city: "Atlanta",
				regionCode: "GA",
				postal: "30337",
			}),
		});
	});

	it("keeps the typed city when the user wrote a full state name", () => {
		expect(
			resolveStopFromGoogleWaypoint("Jessup, Maryland", {
				resolvedAddress: "8201 Stayton Dr, Jessup, MD 20794, USA",
				latitude: 39.149,
				longitude: -76.7752,
				zipCode: "20794",
			}),
		).toEqual({
			location: "Jessup, MD 20794",
			latitude: 39.149,
			longitude: -76.7752,
			zipCode: "20794",
			error: null,
		});
	});

	it("auto-corrects a near-miss city spelling when Google resolved the real name", () => {
		expect(
			resolveStopFromGoogleWaypoint("Waseon, Ohio 43567", {
				resolvedAddress: "123 N Fulton St, Wauseon, OH 43567, USA",
				latitude: 41.5492,
				longitude: -84.1416,
				zipCode: "43567",
			}),
		).toEqual({
			location: "Wauseon, OH 43567",
			latitude: 41.5492,
			longitude: -84.1416,
			zipCode: "43567",
			error: null,
		});
	});

	it("auto-corrects Forth Worth typo when ZIP matches", () => {
		expect(
			resolveStopFromGoogleWaypoint("Forth worth, Tx 76112", {
				resolvedAddress: "Fort Worth, TX 76112, USA",
				latitude: 32.7357,
				longitude: -97.214,
				zipCode: "76112",
			}),
		).toEqual({
			location: "Fort Worth, TX 76112",
			latitude: 32.7357,
			longitude: -97.214,
			zipCode: "76112",
			error: null,
		});
	});

	it("fails when Google did not return a waypoint", () => {
		expect(resolveStopFromGoogleWaypoint("Chicago, IL 60666", null).error).toBe(
			LOCATION_GEOCODE_ERROR,
		);
	});
});

describe("applyGoogleWaypointsToLocations", () => {
	it("maps waypoints 1:1 with typed stops", () => {
		const stops = applyGoogleWaypointsToLocations(
			["College Park, GA 30337", "Aberdeen, NC 28315"],
			[
				{
					resolvedAddress: "College Park, GA 30337, USA",
					latitude: 33.6534,
					longitude: -84.4494,
					zipCode: "30337",
				},
				{
					resolvedAddress: "Aberdeen, NC 28315, USA",
					latitude: 35.1315,
					longitude: -79.4295,
					zipCode: "28315",
				},
			],
		);
		expect(stops.map((stop) => stop.location)).toEqual([
			"College Park, GA 30337",
			"Aberdeen, NC 28315",
		]);
		expect(stops.every((stop) => stop.error == null)).toBe(true);
	});
});

describe("enrichStopsWithPostal", () => {
	it("fills ZIP from reverse geocode when Google omitted it", async () => {
		const reverse = jest.fn(async () => ({
			postal: "79101",
			city: "Amarillo",
			regionCode: "TX",
		}));
		const stops = await enrichStopsWithPostal(
			[
				{
					location: "Amarillo, TX",
					latitude: 35.222,
					longitude: -101.8313,
					zipCode: null,
					error: null,
				},
			],
			reverse,
		);
		expect(reverse).toHaveBeenCalledWith(35.222, -101.8313);
		expect(stops[0]).toEqual({
			location: "Amarillo, TX 79101",
			latitude: 35.222,
			longitude: -101.8313,
			zipCode: "79101",
			error: null,
		});
	});

	it("skips reverse when the stop already has a ZIP", async () => {
		const reverse = jest.fn(async () => ({ postal: "00000" }));
		const stops = await enrichStopsWithPostal(
			[
				{
					location: "Amarillo, TX 79101",
					latitude: 35.222,
					longitude: -101.8313,
					zipCode: "79101",
					error: null,
				},
			],
			reverse,
		);
		expect(reverse).not.toHaveBeenCalled();
		expect(stops[0].zipCode).toBe("79101");
	});
});

describe("mergeChunkedWaypoints", () => {
	it("drops the overlapping origin on later chunks", () => {
		const first = mergeChunkedWaypoints(
			[],
			[
				{ resolvedAddress: "A", latitude: 1, longitude: 1, zipCode: "11111" },
				{ resolvedAddress: "B", latitude: 2, longitude: 2, zipCode: "22222" },
			],
			true,
		);
		const merged = mergeChunkedWaypoints(
			first,
			[
				{ resolvedAddress: "B", latitude: 2, longitude: 2, zipCode: "22222" },
				{ resolvedAddress: "C", latitude: 3, longitude: 3, zipCode: "33333" },
			],
			false,
		);
		expect(merged.map((point) => point.resolvedAddress)).toEqual(["A", "B", "C"]);
	});
});
