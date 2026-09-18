import { isTmsDriverAtOpenBidLimit } from "../filterTmsDriversAtOpenBidLimit";

describe("isTmsDriverAtOpenBidLimit", () => {
	it("matches TMS id or meta_data.driver_id", () => {
		const atLimit = new Set(["3343"]);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "99", meta_data: { driver_id: "3343" } },
				atLimit
			)
		).toBe(true);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "3343", meta_data: { driver_id: "other" } },
				atLimit
			)
		).toBe(true);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "1", meta_data: { driver_id: "2" } },
				atLimit
			)
		).toBe(false);
	});
});
