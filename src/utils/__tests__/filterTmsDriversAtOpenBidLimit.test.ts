import {
	filterTmsDriversSearchPayload,
	isTmsDriverAtOpenBidLimit,
} from "../filterTmsDriversAtOpenBidLimit";

describe("filterTmsDriversAtOpenBidLimit", () => {
	it("matches TMS id or meta_data.driver_id", () => {
		const excluded = new Set(["3343"]);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "99", meta_data: { driver_id: "3343" } },
				excluded
			)
		).toBe(true);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "3343", meta_data: { driver_id: "other" } },
				excluded
			)
		).toBe(true);
		expect(
			isTmsDriverAtOpenBidLimit(
				{ id: "1", meta_data: { driver_id: "2" } },
				excluded
			)
		).toBe(false);
	});

	it("filters results and id_posts without changing pagination", () => {
		const payload = {
			data: {
				results: [
					{ id: "1", meta_data: { driver_id: "3343" } },
					{ id: "2", meta_data: { driver_id: "9999" } },
				],
				id_posts: { "3343": { distance: 10 }, "9999": { distance: 20 } },
				pagination: { current_page: 1, total_pages: 1, total_posts: 2 },
			},
		};
		filterTmsDriversSearchPayload(payload, new Set(["3343"]));
		expect(payload.data.results).toHaveLength(1);
		expect(payload.data.results[0].id).toBe("2");
		expect(payload.data.id_posts).toEqual({ "9999": { distance: 20 } });
		expect(payload.data.pagination.total_posts).toBe(2);
	});
});
