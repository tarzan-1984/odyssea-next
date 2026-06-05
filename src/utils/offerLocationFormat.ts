/** ZIP pattern: 5 digits, optionally +4 */
export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/** City, State format: "City, State" or "City, State (ZIP)" */
const CITY_STATE_PATTERN = /^[^,]+\s*,\s*[^,]+$/;

/** "City, ST" with two-letter abbreviation — needs geocoding to add ZIP */
export const CITY_STATE_ABBR_PATTERN = /^([^,]+),\s*([A-Za-z]{2})\s*$/;

export const LOCATION_FORMAT_ERROR =
	"Use format: City, State (e.g. Los Angeles, CA), City State, or ZIP code";

function isValidSpaceSeparatedLocation(value: string): boolean {
	if (value.includes(",")) return false;
	const parts = value.trim().split(/\s+/);
	if (parts.length < 2) return false;
	const last = parts[parts.length - 1];
	if (ZIP_PATTERN.test(last)) {
		return parts.length >= 3;
	}
	return true;
}

export function isValidLocationFormat(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const normalized = trimmed.replace(/\s/g, "");
	if (ZIP_PATTERN.test(normalized)) return true;
	if (CITY_STATE_PATTERN.test(trimmed)) return true;
	return isValidSpaceSeparatedLocation(trimmed);
}

/**
 * Normalize space-separated input for geocoding or display.
 * - "City ST ZIP" / "City State ZIP" -> ZIP (best geocode result)
 * - "City ST" -> "City, ST"
 * - "City State" -> "City, State"
 */
export function normalizeLocationForGeocode(value: string): string {
	const trimmed = value.trim();
	if (!trimmed || trimmed.includes(",")) return trimmed;

	const parts = trimmed.split(/\s+/);
	if (parts.length < 2) return trimmed;

	let zip: string | undefined;
	let rest = parts;
	const last = parts[parts.length - 1];
	if (ZIP_PATTERN.test(last)) {
		zip = last;
		rest = parts.slice(0, -1);
	}

	if (rest.length < 2) {
		return zip ?? trimmed;
	}

	const stateToken = rest[rest.length - 1];
	const city = rest.slice(0, -1).join(" ");

	if (zip) {
		return zip;
	}

	if (/^[A-Za-z]{2}$/.test(stateToken)) {
		return `${city}, ${stateToken}`;
	}

	return `${city}, ${stateToken}`;
}

export function needsLocationGeocode(value: string): boolean {
	const geocodeAddress = normalizeLocationForGeocode(value);
	return (
		ZIP_PATTERN.test(geocodeAddress.replace(/\s/g, "")) ||
		CITY_STATE_ABBR_PATTERN.test(geocodeAddress)
	);
}
