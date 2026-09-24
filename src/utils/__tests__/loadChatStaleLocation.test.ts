import {
	isLoadChatLocationStale,
	resolveLoadChatStaleLocationAlert,
} from "@/utils/loadChatStaleLocation";

describe("loadChatStaleLocation", () => {
	it("shows alert when last update is older than 30 minutes on active load", () => {
		const input = {
			type: "LOAD",
			loadStatus: "loaded_enroute",
			isRest: false,
			lastLocationUpdateAt: "2026-09-24 04:34:10",
		};
		// Fixed "now" via Date.now mock isn't needed: function uses wall clock internally;
		// assert shape for clearly-old timestamp relative to any reasonable test run date.
		expect(isLoadChatLocationStale(input)).toBe(true);
		expect(resolveLoadChatStaleLocationAlert(input)).toContain(
			"No location updates for over 30 minutes"
		);
		expect(resolveLoadChatStaleLocationAlert(input)).toContain("4.34AM EST");
	});

	it("hides alert while load is resting", () => {
		const input = {
			type: "LOAD",
			loadStatus: "loaded_enroute",
			isRest: true,
			lastLocationUpdateAt: "2026-09-24 04:34:10",
		};
		expect(isLoadChatLocationStale(input)).toBe(false);
		expect(resolveLoadChatStaleLocationAlert(input)).toBeNull();
	});

	it("hides alert for delivered loads", () => {
		const input = {
			type: "LOAD",
			loadStatus: "delivered",
			isRest: false,
			lastLocationUpdateAt: "2026-09-24 04:34:10",
		};
		expect(isLoadChatLocationStale(input)).toBe(false);
	});
});
