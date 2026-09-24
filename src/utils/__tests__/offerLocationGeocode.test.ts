import {
	geocodeOfferAddressCoordinates,
	geocodeOfferToFormattedAddress,
	diagnoseOfferLocationError,
} from "../offerLocationGeocode";
import { formatLocationZipMismatchError } from "../offerLocationFormat";

type ZippPlace = {
	"place name": string;
	"post code"?: string;
	state: string;
	"state abbreviation": string;
	latitude: string;
	longitude: string;
};

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as Response;
}

function postalBody(place: ZippPlace) {
	return {
		"place name": place["place name"],
		state: place.state,
		"state abbreviation": place["state abbreviation"],
		places: [place],
	};
}

describe("geocodeOfferAddressCoordinates", () => {
	const fetchMock = jest.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	it("geocodes College Park GA 30337 even when Zippopotam names the ZIP Atlanta", async () => {
		const atlantaZip: ZippPlace = {
			"place name": "Atlanta",
			"post code": "30337",
			state: "Georgia",
			"state abbreviation": "GA",
			latitude: "33.6428",
			longitude: "-84.4618",
		};

		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			const url = decodeURIComponent(String(input));
			if (url.includes("/us/30337")) {
				return jsonResponse(postalBody(atlantaZip));
			}
			return jsonResponse({}, 404);
		});

		const point = await geocodeOfferAddressCoordinates("College Park, GA 30337");
		expect(point).toEqual({ lat: 33.6428, lon: -84.4618 });
	});

	it("rejects College Park MD when ZIP 30337 is in Georgia", async () => {
		const atlantaZip: ZippPlace = {
			"place name": "Atlanta",
			"post code": "30337",
			state: "Georgia",
			"state abbreviation": "GA",
			latitude: "33.6428",
			longitude: "-84.4618",
		};

		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			const url = decodeURIComponent(String(input));
			if (url.includes("/us/30337")) {
				return jsonResponse(postalBody(atlantaZip));
			}
			return jsonResponse({}, 404);
		});

		await expect(geocodeOfferAddressCoordinates("College Park, MD 30337")).resolves.toBeNull();
	});

	it("geocodes Chicago IL 60666 even when Zippopotam names the ZIP Amf Ohare", async () => {
		const ohare: ZippPlace = {
			"place name": "Amf Ohare",
			"post code": "60666",
			state: "Illinois",
			"state abbreviation": "IL",
			latitude: "41.968",
			longitude: "-87.8912",
		};
		const chicagoPlace: ZippPlace = {
			"place name": "Chicago",
			"post code": "60601",
			state: "Illinois",
			"state abbreviation": "IL",
			latitude: "41.8839",
			longitude: "-87.6317",
		};

		fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/us/60666")) {
				return jsonResponse(postalBody(ohare));
			}
			if (url.includes("/us/il/CHICAGO") || url.includes("/us/il/Chicago")) {
				return jsonResponse({
					"place name": "Chicago",
					state: "Illinois",
					"state abbreviation": "IL",
					places: [chicagoPlace],
				});
			}
			return jsonResponse({}, 404);
		});

		const point = await geocodeOfferAddressCoordinates("CHICAGO, IL 60666");
		expect(point).toEqual({ lat: 41.968, lon: -87.8912 });
	});

	it.each([
		"BENZONIA, MI 49616",
		"BENZONIA, MI, 49616",
		"BENZONIA, MI, 49616 USA",
	])("geocodes %j via Zippopotam", async (input) => {
		const benzonia: ZippPlace = {
			"place name": "Benzonia",
			"post code": "49616",
			state: "Michigan",
			"state abbreviation": "MI",
			latitude: "44.5955",
			longitude: "-86.0961",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = String(inputUrl);
			if (url.includes("/us/49616")) {
				return jsonResponse(postalBody(benzonia));
			}
			if (url.includes("/us/mi/BENZONIA") || url.includes("/us/mi/Benzonia")) {
				return jsonResponse({
					"place name": "Benzonia",
					state: "Michigan",
					"state abbreviation": "MI",
					places: [benzonia],
				});
			}
			return jsonResponse({}, 404);
		});

		const point = await geocodeOfferAddressCoordinates(input);
		expect(point).toEqual({ lat: 44.5955, lon: -86.0961 });
	});

	it("geocodes Elk Grove Vlg via expanded Village name", async () => {
		const village: ZippPlace = {
			"place name": "Elk Grove Village",
			"post code": "60007",
			state: "Illinois",
			"state abbreviation": "IL",
			latitude: "42.0076",
			longitude: "-87.9931",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/il/Elk Grove Village")) {
				return jsonResponse({
					"place name": "Elk Grove Village",
					state: "Illinois",
					"state abbreviation": "IL",
					places: [village],
				});
			}
			return jsonResponse({}, 404);
		});

		const point = await geocodeOfferAddressCoordinates("Elk Grove Vlg, IL");
		expect(point).toEqual({ lat: 42.0076, lon: -87.9931 });
	});
});

describe("geocodeOfferToFormattedAddress", () => {
	const fetchMock = jest.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	it("keeps College Park when ZIP 30337 is listed as Atlanta", async () => {
		const atlantaZip: ZippPlace = {
			"place name": "Atlanta",
			"post code": "30337",
			state: "Georgia",
			"state abbreviation": "GA",
			latitude: "33.6428",
			longitude: "-84.4618",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/30337")) {
				return jsonResponse(postalBody(atlantaZip));
			}
			return jsonResponse({}, 404);
		});

		await expect(geocodeOfferToFormattedAddress("College Park, GA 30337")).resolves.toBe(
			"College Park, GA 30337",
		);
	});

	it("formats Elk Grove Vlg as Elk Grove Village", async () => {
		const village: ZippPlace = {
			"place name": "Elk Grove Village",
			"post code": "60007",
			state: "Illinois",
			"state abbreviation": "IL",
			latitude: "42.0076",
			longitude: "-87.9931",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/il/Elk Grove Village")) {
				return jsonResponse({
					"place name": "Elk Grove Village",
					state: "Illinois",
					"state abbreviation": "IL",
					places: [village],
				});
			}
			return jsonResponse({}, 404);
		});

		await expect(geocodeOfferToFormattedAddress("Elk Grove Vlg, IL")).resolves.toBe(
			"Elk Grove Village, IL 60007",
		);
	});
});

describe("diagnoseOfferLocationError", () => {
	const fetchMock = jest.fn();

	beforeEach(() => {
		fetchMock.mockReset();
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	it("flags Morristown when ZIP 08057 belongs to Moorestown", async () => {
		const moorestown: ZippPlace = {
			"place name": "Moorestown",
			"post code": "08057",
			state: "New Jersey",
			"state abbreviation": "NJ",
			latitude: "39.9683",
			longitude: "-74.9533",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/08057")) {
				return jsonResponse(postalBody(moorestown));
			}
			if (url.includes("/us/nj/Morristown") || url.includes("/us/nj/morristown")) {
				return jsonResponse({
					"place name": "Morristown",
					state: "New Jersey",
					"state abbreviation": "NJ",
					places: [
						{
							"place name": "Morristown",
							"post code": "07960",
							state: "New Jersey",
							"state abbreviation": "NJ",
							latitude: "40.7952",
							longitude: "-74.4873",
						},
					],
				});
			}
			return jsonResponse({}, 404);
		});

		await expect(diagnoseOfferLocationError("Morristown, NJ 08057")).resolves.toBe(
			formatLocationZipMismatchError({
				city: "Moorestown",
				regionCode: "NJ",
				postal: "08057",
			}),
		);
	});

	it("does not flag College Park GA 30337 on blur (airport ZIP)", async () => {
		const atlantaZip: ZippPlace = {
			"place name": "Atlanta",
			"post code": "30337",
			state: "Georgia",
			"state abbreviation": "GA",
			latitude: "33.6428",
			longitude: "-84.4618",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/30337")) {
				return jsonResponse(postalBody(atlantaZip));
			}
			if (url.includes("/us/ga/College Park") || url.includes("/us/ga/College%20Park")) {
				return jsonResponse({
					"place name": "College Park",
					state: "Georgia",
					"state abbreviation": "GA",
					places: [
						{
							"place name": "College Park",
							"post code": "30349",
							state: "Georgia",
							"state abbreviation": "GA",
							latitude: "33.6534",
							longitude: "-84.4494",
						},
					],
				});
			}
			return jsonResponse({}, 404);
		});

		await expect(diagnoseOfferLocationError("College Park, GA 30337")).resolves.toBeNull();
	});

	it("flags College Park GA 30337 when requireCityPostalMatch is set", async () => {
		const atlantaZip: ZippPlace = {
			"place name": "Atlanta",
			"post code": "30337",
			state: "Georgia",
			"state abbreviation": "GA",
			latitude: "33.6428",
			longitude: "-84.4618",
		};

		fetchMock.mockImplementation(async (inputUrl: RequestInfo | URL) => {
			const url = decodeURIComponent(String(inputUrl));
			if (url.includes("/us/30337")) {
				return jsonResponse(postalBody(atlantaZip));
			}
			return jsonResponse({}, 404);
		});

		await expect(
			diagnoseOfferLocationError("College Park, GA 30337", { requireCityPostalMatch: true }),
		).resolves.toBe(
			formatLocationZipMismatchError({
				city: "Atlanta",
				regionCode: "GA",
				postal: "30337",
			}),
		);
	});
});
