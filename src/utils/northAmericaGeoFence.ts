/** USA / Canada / Mexico boxes. A non-test driver cannot be plotted outside them. */
type LatLng = { latitude: number; longitude: number };
type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

const NORTH_AMERICA_BBOXES: readonly BBox[] = [
	{ minLat: 24, maxLat: 71, minLng: -168, maxLng: -52 },
	{ minLat: 51, maxLat: 72, minLng: -179, maxLng: -129 },
	{ minLat: 18, maxLat: 23, minLng: -161, maxLng: -154 },
	{ minLat: 14, maxLat: 33, minLng: -119, maxLng: -86 },
];

export function isAllowedNorthAmericaLatLng(point: LatLng): boolean {
	if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
		return false;
	}
	return NORTH_AMERICA_BBOXES.some(
		(box) =>
			point.latitude >= box.minLat &&
			point.latitude <= box.maxLat &&
			point.longitude >= box.minLng &&
			point.longitude <= box.maxLng,
	);
}
