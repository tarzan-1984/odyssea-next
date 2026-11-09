import {
	defaultPickupDateTime,
	formatOfferDateTime,
	formatOfferDateTimeRange,
	getRouteStopMinDate,
	offerStopTimeOrNewYorkNow,
	parseOfferDateTimeField,
	hour24DigitsTo12,
	parseOfferRouteDateTime,
	roundUpToTenMinutes,
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

describe("hour24DigitsTo12", () => {
	it("converts 24-hour hours to 12-hour AM/PM", () => {
		expect(hour24DigitsTo12("14")).toEqual({ hour12: "02", period: "PM" });
		expect(hour24DigitsTo12("00")).toEqual({ hour12: "12", period: "AM" });
		expect(hour24DigitsTo12("16")).toEqual({ hour12: "04", period: "PM" });
		expect(hour24DigitsTo12("12")).toEqual({ hour12: "12", period: "PM" });
		expect(hour24DigitsTo12("09")).toEqual({ hour12: "09", period: "AM" });
	});

	it("rejects hours above 23", () => {
		expect(hour24DigitsTo12("24")).toBeNull();
		expect(hour24DigitsTo12("3")).toBeNull();
	});
});

describe("URL offer time", () => {
	it("pads a single hour and minute digit from a GET param", () => {
		const parsed = parseOfferRouteDateTime("9/11/2026 3:5 PM");
		expect(parsed).not.toBeNull();
		expect(formatOfferDateTime(parsed!)).toBe("9/11/2026 03:05 PM");
	});

	it("converts a 24-hour GET time and pads a single minute", () => {
		const parsed = parseOfferRouteDateTime("9/11/2026 14:5");
		expect(formatOfferDateTime(parsed!)).toBe("9/11/2026 02:05 PM");
	});

	it("uses 00 when a GET time has hours and no minutes", () => {
		expect(formatOfferDateTime(parseOfferRouteDateTime("9/11/2026 3 PM")!)).toBe("9/11/2026 03:00 PM");
		expect(formatOfferDateTime(parseOfferRouteDateTime("9/11/2026 14")!)).toBe("9/11/2026 02:00 PM");
	});

	it("pads the optional end time from a GET range", () => {
		const { start, end } = parseOfferDateTimeField("9/11/2026 3:5 PM - 4:5 PM");
		expect(start).not.toBeNull();
		expect(end).not.toBeNull();
		expect(formatOfferDateTimeRange(start!, end)).toBe("9/11/2026 03:05 PM — 04:05 PM");
	});
});

describe("New York default offer time", () => {
	const instant = new Date("2026-09-30T16:23:00Z");

	it("uses New York now + 30 minutes, rounded up to 10 minutes", () => {
		// 16:23 UTC → 12:23 PM NY; +30 → 12:53 PM; round up → 1:00 PM
		expect(defaultPickupDateTime(instant)).toBe("9/30/2026 01:00 PM");
	});

	it("keeps a GET date and fills the missing time from New York + 30", () => {
		expect(offerStopTimeOrNewYorkNow("8/13/2026", instant)).toBe("8/13/2026 01:00 PM");
	});

	it("keeps a GET datetime that already has a time", () => {
		expect(offerStopTimeOrNewYorkNow("9/11/2026 3:5 PM", instant)).toBe("9/11/2026 03:05 PM");
	});
});

describe("roundUpToTenMinutes", () => {
	it("rounds up to the next 10 minutes and keeps exact marks", () => {
		expect(roundUpToTenMinutes(new Date(2026, 8, 30, 11, 23)).getMinutes()).toBe(30);
		expect(roundUpToTenMinutes(new Date(2026, 8, 30, 11, 30)).getMinutes()).toBe(30);
		const rolled = roundUpToTenMinutes(new Date(2026, 8, 30, 11, 51));
		expect(rolled.getHours()).toBe(12);
		expect(rolled.getMinutes()).toBe(0);
	});
});
