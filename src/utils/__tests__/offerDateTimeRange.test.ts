import {
	getRouteStopMinDate,
	parseOfferRouteDateTime,
} from "../offerDateTimeRange";

describe("getRouteStopMinDate", () => {
	it("returns the previous stop datetime for delivery", () => {
		const pickup = "8/25/2026 3:44 PM";
		const min = getRouteStopMinDate([pickup, ""], 1);
		expect(min?.getTime()).toBe(parseOfferRouteDateTime(pickup)?.getTime());
	});

	it("returns null for the first stop", () => {
		expect(getRouteStopMinDate(["8/25/2026 3:44 PM", ""], 0)).toBeNull();
	});

	it("skips empty previous stops", () => {
		const pickup = "8/25/2026 10:00 AM";
		const min = getRouteStopMinDate([pickup, "", ""], 2);
		expect(min?.getTime()).toBe(parseOfferRouteDateTime(pickup)?.getTime());
	});
});
