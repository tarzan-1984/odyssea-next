import { geocodeOfferAddressCoordinates } from "../offerLocationGeocode";

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
});
