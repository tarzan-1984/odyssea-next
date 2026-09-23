import { mergeLoadRestFields } from "../mergeLoadRestFields";

describe("mergeLoadRestFields", () => {
	it("keeps the current restDate when rest is still on and the patch has no date", () => {
		expect(
			mergeLoadRestFields(
				{
					isRest: true,
					restDate: "2026-09-22T15:00:00.000Z",
					restStartedAt: "2026-09-22T10:00:00.000Z",
				},
				{ isRest: true, restDate: null, restStartedAt: null },
			),
		).toEqual({
			isRest: true,
			restDate: "2026-09-22T15:00:00.000Z",
			restStartedAt: "2026-09-22T10:00:00.000Z",
		});
	});

	it("applies a new restDate while rest stays on", () => {
		expect(
			mergeLoadRestFields(
				{ isRest: true, restDate: "2026-09-22T15:00:00.000Z" },
				{ isRest: true, restDate: "2026-09-22T18:00:00.000Z" },
			),
		).toEqual({
			isRest: true,
			restDate: "2026-09-22T18:00:00.000Z",
			restStartedAt: null,
		});
	});

	it("clears rest dates when rest is turned off", () => {
		expect(
			mergeLoadRestFields(
				{
					isRest: true,
					restDate: "2026-09-22T15:00:00.000Z",
					restStartedAt: "2026-09-22T10:00:00.000Z",
				},
				{ isRest: false, restDate: null },
			),
		).toEqual({
			isRest: false,
			restDate: null,
			restStartedAt: null,
		});
	});
});
