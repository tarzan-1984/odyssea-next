import {
	formatRestCountdown,
	remainingRestMs,
	restCountdownTone,
} from "../restCountdown";

describe("remainingRestMs", () => {
	it("counts remaining time against America/New_York wall-clock", () => {
		// 12:00 NY on 2026-09-22 (EDT = UTC-4) is 16:00 UTC.
		// Rest ends 15:00 NY (stored as naive 15:00Z) → 3 hours left.
		expect(
			remainingRestMs("2026-09-22T15:00:00.000Z", Date.parse("2026-09-22T16:00:00.000Z")),
		).toBe(3 * 60 * 60 * 1000);
	});

	it("clamps expired rest to zero", () => {
		expect(
			remainingRestMs("2026-09-22T10:00:00.000Z", Date.parse("2026-09-22T16:00:00.000Z")),
		).toBe(0);
	});
});

describe("formatRestCountdown", () => {
	it("formats hours, minutes, and seconds", () => {
		expect(formatRestCountdown(((2 * 60 + 3) * 60 + 4) * 1000)).toBe("02:03:04");
	});
});

describe("restCountdownTone", () => {
	const start = "2026-09-22T10:00:00.000Z";
	const end = "2026-09-22T13:00:00.000Z";

	it("is green at the start of rest", () => {
		expect(restCountdownTone(3 * 60 * 60 * 1000, end, start)).toBe("green");
	});

	it("is yellow around the midpoint", () => {
		expect(restCountdownTone(90 * 60 * 1000, end, start)).toBe("yellow");
	});

	it("is red near the end", () => {
		expect(restCountdownTone(10 * 60 * 1000, end, start)).toBe("red");
	});
});
