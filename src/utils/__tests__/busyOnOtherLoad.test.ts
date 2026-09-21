import { parseBusyOnOtherLoad, busyOnOtherLoadHref, busyOnOtherLoadRefLabel } from "../busyOnOtherLoad";

describe("busyOnOtherLoad", () => {
	it("parses load id and reference, and builds the TMS link", () => {
		const busy = parseBusyOnOtherLoad({
			loadId: 30134,
			referenceNumber: "10174",
		});
		expect(busy).toEqual({ loadId: 30134, referenceNumber: "10174" });
		expect(busyOnOtherLoadRefLabel(busy!)).toBe("10174");
		expect(busyOnOtherLoadHref(busy!)).toBe(
			"https://www.endurance-tms.com/add-load/?post_id=30134",
		);
	});

	it("falls back to load id when reference is missing", () => {
		const busy = parseBusyOnOtherLoad({ loadId: "30134" });
		expect(busyOnOtherLoadRefLabel(busy!)).toBe("30134");
	});
});
