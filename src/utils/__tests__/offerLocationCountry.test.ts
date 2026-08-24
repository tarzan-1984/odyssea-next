import {
	canonicalizeOfferLocation,
	parseCityRegionCode,
	parseCityRegionFromAddress,
	parseCityRegionPostalLine,
} from "../offerLocationCountry";
import {
	isValidLocationFormat,
	normalizeLocationForGeocode,
} from "../offerLocationFormat";

describe("canonicalizeOfferLocation", () => {
	it.each([
		["BENZONIA, MI, 49616", "BENZONIA, MI 49616"],
		["BENZONIA, MI, 49616 USA", "BENZONIA, MI 49616"],
		["BENZONIA, MI 49616 USA", "BENZONIA, MI 49616"],
		["BENZONIA. MI", "BENZONIA, MI"],
		["BENZONIA. MI 49616", "BENZONIA, MI 49616"],
		["CHICAGO, IL 60666", "CHICAGO, IL 60666"],
		["CHICAGO, IL 60666, USA", "CHICAGO, IL 60666"],
		["CHICAGO, IL 60666 USA", "CHICAGO, IL 60666"],
		["Chicago, IL, 60666, United States", "Chicago, IL 60666"],
		["St. Louis, MO, 63101, USA", "St. Louis, MO 63101"],
		["Phoenix, AZ, 85001", "Phoenix, AZ 85001"],
	])("normalizes %j", (input, expected) => {
		expect(canonicalizeOfferLocation(input)).toBe(expected);
	});

	it("is idempotent for canonical city/state/ZIP", () => {
		expect(canonicalizeOfferLocation("BENZONIA, MI 49616")).toBe("BENZONIA, MI 49616");
	});
});

describe("parseCityRegionPostalLine", () => {
	it.each([
		"BENZONIA, MI 49616",
		"BENZONIA, MI, 49616",
		"BENZONIA, MI, 49616 USA",
		"BENZONIA, MI 49616 USA",
	])("parses %j", (input) => {
		expect(parseCityRegionPostalLine(input)).toEqual({
			city: "BENZONIA",
			regionCode: "MI",
			postal: "49616",
			country: "us",
		});
	});

	it("parses Chicago airport ZIP", () => {
		expect(parseCityRegionPostalLine("CHICAGO, IL 60666")).toEqual({
			city: "CHICAGO",
			regionCode: "IL",
			postal: "60666",
			country: "us",
		});
	});

	it("parses Chicago airport ZIP with country suffix", () => {
		expect(parseCityRegionPostalLine("CHICAGO, IL 60666, USA")).toEqual({
			city: "CHICAGO",
			regionCode: "IL",
			postal: "60666",
			country: "us",
		});
	});
});

describe("parseCityRegionFromAddress", () => {
	it("parses period-separated city/state", () => {
		expect(parseCityRegionFromAddress("BENZONIA. MI")).toEqual({
			city: "BENZONIA",
			regionCode: "MI",
			country: "us",
		});
	});

	it("parses city/state without ZIP", () => {
		expect(parseCityRegionCode("BENZONIA. MI")).toEqual({
			city: "BENZONIA",
			regionCode: "MI",
			country: "us",
		});
	});
});

describe("location format", () => {
	it.each([
		"BENZONIA, MI, 49616",
		"BENZONIA, MI, 49616 USA",
		"BENZONIA. MI",
		"CHICAGO, IL 60666",
		"CHICAGO, IL 60666, USA",
		"CHICAGO, IL 60666 USA",
	])("accepts %j", (input) => {
		expect(isValidLocationFormat(input)).toBe(true);
	});

	it("normalizes extra commas for geocoding", () => {
		expect(normalizeLocationForGeocode("BENZONIA, MI, 49616 USA")).toBe(
			"BENZONIA, MI 49616",
		);
		expect(normalizeLocationForGeocode("CHICAGO, IL 60666, USA")).toBe(
			"CHICAGO, IL 60666",
		);
	});
});
