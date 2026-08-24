import {
	CA_POSTAL_PATTERN,
	canonicalizeOfferLocation,
	isBarePostalInput,
	isCanadianPostalCode,
	MX_CP_PATTERN,
	normalizePostalInput,
	parseCityRegionCode,
} from "./offerLocationCountry";

/** Canadian FSA (3-character postal prefix), e.g. N7M */
export const CA_FSA_PATTERN = /^[A-Za-z]\d[A-Za-z]$/;

/** ZIP pattern: US 5 digits, optionally +4 */
export const ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/** City, State format: "City, State" or "City, State ZIP" */
const CITY_STATE_PATTERN = /^[^,]+\s*,\s*[^,]+$/;

/** "City, ST" or "City, JAL" — needs geocoding to add postal code */
export const CITY_STATE_ABBR_PATTERN = /^([^,]+),\s*([A-Za-z]{2,4})\s*$/;

export const LOCATION_FORMAT_ERROR =
	"Use format: City, State (e.g. Los Angeles, CA / Chatham, ON), City State, or postal/ZIP (e.g. N7M, 06600, 90210)";

export const LOCATION_GEOCODE_ERROR =
	"Could not find this location. Enter a real city, state, and ZIP.";

export const LOCATION_ZIP_MISMATCH_ERROR =
	"City and ZIP do not match. Enter the real city for this postal code.";

export const LOCATION_POSTAL_ERROR =
	"Each stop must include a ZIP / postal code (e.g. Los Angeles, CA 90001).";

export const LOCATION_COORDINATES_ERROR =
	"Each stop must have coordinates — blur each location field to resolve the address";

/** True when the location already contains a US ZIP, CA postal, or MX CP. */
export function locationHasPostalCode(value: string): boolean {
	const trimmed = normalizePostalInput(value.trim());
	if (!trimmed) return false;
	if (isBarePostalInput(trimmed) || CA_FSA_PATTERN.test(trimmed)) return true;
	if (/\b\d{5}(?:-\d{4})?\b/.test(trimmed)) return true;
	if (/\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/.test(trimmed)) return true;
	const last = trimmed.split(/\s+/).pop() ?? "";
	return CA_FSA_PATTERN.test(last);
}

function isValidSpaceSeparatedLocation(value: string): boolean {
	if (value.includes(",")) return false;
	const parts = value.trim().split(/\s+/);
	if (parts.length < 2) return false;
	const last = parts[parts.length - 1];
	if (ZIP_PATTERN.test(last) || CA_POSTAL_PATTERN.test(last) || MX_CP_PATTERN.test(last)) {
		return parts.length >= 3;
	}
	if (/^[A-Za-z]{2,4}$/.test(last)) {
		return parseCityRegionCode(`City, ${last}`) != null || parts.length >= 2;
	}
	return true;
}

export function isValidLocationFormat(value: string): boolean {
	const trimmed = canonicalizeOfferLocation(value);
	if (!trimmed) return true;

	if (isBarePostalInput(trimmed) || CA_FSA_PATTERN.test(trimmed)) return true;

	const compact = trimmed.replace(/\s/g, "");
	if (ZIP_PATTERN.test(compact)) return true;
	if (isCanadianPostalCode(trimmed)) return true;
	if (MX_CP_PATTERN.test(compact) && trimmed.split(/\s+/).length === 1) return true;
	if (CITY_STATE_PATTERN.test(trimmed) && !isCanadianPostalCode(trimmed)) return true;
	return isValidSpaceSeparatedLocation(trimmed);
}

/**
 * Normalize space-separated input for geocoding or display.
 * - "City ST ZIP" / "City State ZIP" -> "City, ST ZIP"
 * - "City ST" -> "City, ST"
 * - "City State" -> "City, State"
 */
export function normalizeLocationForGeocode(value: string): string {
	const trimmed = canonicalizeOfferLocation(value);
	if (!trimmed) return trimmed;
	if (isCanadianPostalCode(trimmed)) {
		return trimmed.replace(/\s+/g, " ").trim().toUpperCase();
	}
	if (trimmed.includes(",")) return trimmed;

	const parts = trimmed.split(/\s+/);
	if (parts.length < 2) return trimmed;

	let postal: string | undefined;
	let rest = parts;
	const last = parts[parts.length - 1];
	if (ZIP_PATTERN.test(last) || CA_POSTAL_PATTERN.test(last) || MX_CP_PATTERN.test(last)) {
		postal = last;
		rest = parts.slice(0, -1);
	}

	if (rest.length < 2) {
		return postal ?? trimmed;
	}

	const regionToken = rest[rest.length - 1];
	const city = rest.slice(0, -1).join(" ");

	if (postal) {
		return `${city}, ${regionToken} ${postal}`;
	}

	if (/^[A-Za-z]{2,4}$/.test(regionToken)) {
		return `${city}, ${regionToken}`;
	}

	return `${city}, ${regionToken}`;
}

export function needsLocationGeocode(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;

	const geocodeAddress = normalizeLocationForGeocode(trimmed);
	const compact = geocodeAddress.replace(/\s/g, "");

	if (ZIP_PATTERN.test(compact) || isCanadianPostalCode(geocodeAddress)) {
		return true;
	}

	if (MX_CP_PATTERN.test(compact) && !geocodeAddress.includes(",")) {
		return true;
	}

	if (CITY_STATE_ABBR_PATTERN.test(geocodeAddress) && parseCityRegionCode(geocodeAddress) != null) {
		return true;
	}

	// City/state (or free-text place) without a postal code still needs lookup.
	return !locationHasPostalCode(geocodeAddress);
}
