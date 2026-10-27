export const HISTORY_STOP_MIN_DISTANCE_M = 5000;

export type HistoryStopCoord = {
	latitude: number;
	longitude: number;
};

export function historyStopDistanceMeters(a: HistoryStopCoord, b: HistoryStopCoord): number {
	const earthRadiusM = 6_371_000;
	const toRad = (value: number) => (value * Math.PI) / 180;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;

	return 2 * earthRadiusM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Collapse consecutive points of one stop.
 * Points stay in the stop while they are within minDistanceM of its first point.
 * The map shows the last point of each stop. A later point near an earlier stop
 * stays separate when a longer leg sits between them.
 * `points` must already be in time order.
 */
export function lastIndicesOfConsecutiveStops(
	points: readonly HistoryStopCoord[],
	minDistanceM = HISTORY_STOP_MIN_DISTANCE_M
): number[] {
	if (points.length === 0) return [];

	const visible: number[] = [];
	let anchorIndex = 0;
	let lastIndex = 0;

	for (let i = 1; i < points.length; i++) {
		const distanceM = historyStopDistanceMeters(points[anchorIndex], points[i]);
		if (distanceM < minDistanceM) {
			lastIndex = i;
			continue;
		}
		visible.push(lastIndex);
		anchorIndex = i;
		lastIndex = i;
	}

	visible.push(lastIndex);
	return visible;
}

/** Default stop markers plus points the user opened from the history list. */
export function mergeHistoryPointIndices(
	defaultIndices: readonly number[],
	extraIndices: readonly number[],
	pointCount: number
): number[] {
	const visible = new Set<number>();
	for (const index of defaultIndices) {
		if (index >= 0 && index < pointCount) visible.add(index);
	}
	for (const index of extraIndices) {
		if (index >= 0 && index < pointCount) visible.add(index);
	}
	return [...visible].sort((left, right) => left - right);
}
