import { offerLocationsAreSame } from "../offerLocationFormat";

describe("offerLocationsAreSame", () => {
	it("is true when every stop is the same city and state", () => {
		expect(offerLocationsAreSame(["Atlantic City, NJ", "Atlantic City, NJ"])).toBe(true);
	});

	it("ignores case and City State spacing", () => {
		expect(offerLocationsAreSame(["atlantic city, nj", "Atlantic City NJ"])).toBe(true);
	});

	it("is true for more than two identical stops", () => {
		expect(
			offerLocationsAreSame(["Atlantic City, NJ", "Atlantic City, NJ", "Atlantic City, NJ"])
		).toBe(true);
	});

	it("is false when cities differ", () => {
		expect(offerLocationsAreSame(["Atlantic City, NJ", "Newark, NJ"])).toBe(false);
	});

	it("is false when the same city has different ZIP codes", () => {
		expect(
			offerLocationsAreSame(["Atlantic City, NJ 08401", "Atlantic City, NJ 08234"])
		).toBe(false);
	});

	it("is false for a single stop", () => {
		expect(offerLocationsAreSame(["Atlantic City, NJ"])).toBe(false);
	});
});
