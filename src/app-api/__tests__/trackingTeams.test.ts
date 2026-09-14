import {
	extractTrackingTeamsLoadIds,
	formatTrackingTeamsRequestError,
} from "../trackingTeams";

describe("extractTrackingTeamsLoadIds", () => {
	it("reads flat Nest payload", () => {
		expect(
			extractTrackingTeamsLoadIds({ success: true, loadIds: [29546, "29555"] }),
		).toEqual(["29546", "29555"]);
	});

	it("reads TransformInterceptor { data: { loadIds } }", () => {
		expect(
			extractTrackingTeamsLoadIds({
				data: { success: true, loadIds: ["29546"] },
				timestamp: "2026-09-14T00:00:00.000Z",
				path: "/v1/tracking/teams",
			}),
		).toEqual(["29546"]);
	});

	it("reads nested data.data.loadIds", () => {
		expect(
			extractTrackingTeamsLoadIds({
				data: {
					data: { success: true, loadIds: ["29616", "29683"] },
				},
			}),
		).toEqual(["29616", "29683"]);
	});

	it("reads TMS { data: { load_ids } }", () => {
		expect(
			extractTrackingTeamsLoadIds({
				success: true,
				data: { load_ids: [29689] },
			}),
		).toEqual(["29689"]);
	});

	it("reads data as a raw id array", () => {
		expect(extractTrackingTeamsLoadIds({ data: [1, 2] })).toEqual(["1", "2"]);
	});
});

describe("formatTrackingTeamsRequestError", () => {
	it("includes TMS status, url and body for Endurance", () => {
		const text = formatTrackingTeamsRequestError(
			{
				error: "TMS tracking/teams HTTP 403",
				tmsStatus: 403,
				tmsUrl:
					"https://www.endurance-tms.com/wp-json/tms/v1/tracking/teams?user_id=29&project=odysseia",
				tmsBody: { code: "rest_forbidden", message: "blocked" },
			},
			502,
		);
		expect(text).toContain("TMS tracking/teams HTTP 403");
		expect(text).toContain("tmsStatus: 403");
		expect(text).toContain("tmsBody:");
		expect(text).toContain("rest_forbidden");
	});
});
