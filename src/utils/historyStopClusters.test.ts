import {
	lastIndicesOfConsecutiveStops,
	mergeHistoryPointIndices,
} from "./historyStopClusters";

const origin = { latitude: 33.62, longitude: -97.15 };

function northOf(kilometers: number) {
	return {
		latitude: origin.latitude + kilometers / 111.32,
		longitude: origin.longitude,
	};
}

describe("lastIndicesOfConsecutiveStops", () => {
	it("returns nothing for an empty list", () => {
		expect(lastIndicesOfConsecutiveStops([])).toEqual([]);
	});

	it("keeps a single point", () => {
		expect(lastIndicesOfConsecutiveStops([origin])).toEqual([0]);
	});

	it("keeps only the last point of a stop and starts a new stop after 5 km", () => {
		const points = [origin, northOf(1.1), northOf(2.2), northOf(6.7), northOf(7.8)];
		expect(lastIndicesOfConsecutiveStops(points)).toEqual([2, 4]);
	});

	it("does not merge a later point that returns near an earlier stop", () => {
		const points = [origin, northOf(10), northOf(10.4), origin];
		expect(lastIndicesOfConsecutiveStops(points)).toEqual([0, 2, 3]);
	});
});

describe("mergeHistoryPointIndices", () => {
	it("adds a clicked point and drops indexes outside the list", () => {
		expect(mergeHistoryPointIndices([0, 2], [1, 9], 4)).toEqual([0, 1, 2]);
	});
});
