/**
 * TMS sometimes stores coordinates for a same-named street in another state
 * (for example "900 Convention Way, New Orleans, LA" saved as Anaheim, CA).
 * Reject those points so route geocoding can fall through to the city.
 */

/** minLat, maxLat, minLng, maxLng */
const US_STATE_BOUNDS: Record<string, [number, number, number, number]> = {
	AL: [30.22, 35.01, -88.47, -84.89],
	AZ: [31.33, 37.0, -114.82, -109.04],
	AR: [33.0, 36.5, -94.62, -89.64],
	CA: [32.53, 42.01, -124.41, -114.13],
	CO: [36.99, 41.0, -109.06, -102.04],
	CT: [40.98, 42.05, -73.73, -71.79],
	DE: [38.45, 39.84, -75.79, -75.05],
	DC: [38.79, 38.99, -77.12, -76.91],
	FL: [24.52, 31.0, -87.63, -80.03],
	GA: [30.36, 35.0, -85.61, -80.84],
	HI: [18.91, 22.24, -160.25, -154.81],
	ID: [41.99, 49.0, -117.24, -111.04],
	IL: [36.97, 42.51, -91.51, -87.49],
	IN: [37.77, 41.76, -88.1, -84.78],
	IA: [40.38, 43.5, -96.64, -90.14],
	KS: [36.99, 40.0, -102.05, -94.59],
	KY: [36.5, 39.15, -89.57, -81.96],
	LA: [28.93, 33.02, -94.04, -88.82],
	ME: [43.06, 47.46, -71.08, -66.95],
	MD: [37.91, 39.72, -79.49, -75.05],
	MA: [41.24, 42.89, -73.51, -69.93],
	MI: [41.7, 48.31, -90.42, -82.41],
	MN: [43.5, 49.38, -97.24, -89.49],
	MS: [30.17, 35.0, -91.66, -88.1],
	MO: [35.99, 40.61, -95.77, -89.1],
	MT: [44.36, 49.0, -116.05, -104.04],
	NE: [40.0, 43.0, -104.05, -95.31],
	NV: [35.0, 42.0, -120.01, -114.04],
	NH: [42.7, 45.31, -72.56, -70.7],
	NJ: [38.93, 41.36, -75.56, -73.89],
	NM: [31.33, 37.0, -109.05, -103.0],
	NY: [40.5, 45.02, -79.76, -71.86],
	NC: [33.84, 36.59, -84.32, -75.46],
	ND: [45.94, 49.0, -104.05, -96.55],
	OH: [38.4, 41.98, -84.82, -80.52],
	OK: [33.62, 37.0, -103.0, -94.43],
	OR: [41.99, 46.29, -124.57, -116.46],
	PA: [39.72, 42.27, -80.52, -74.69],
	RI: [41.15, 42.02, -71.86, -71.12],
	SC: [32.05, 35.22, -83.35, -78.54],
	SD: [42.48, 45.95, -104.06, -96.44],
	TN: [34.98, 36.68, -90.31, -81.65],
	TX: [25.84, 36.5, -106.65, -93.51],
	UT: [36.99, 42.0, -114.05, -109.04],
	VT: [42.73, 45.02, -73.44, -71.46],
	VA: [36.54, 39.47, -83.68, -75.24],
	WA: [45.54, 49.0, -124.76, -116.92],
	WV: [37.2, 40.64, -82.64, -77.72],
	WI: [42.49, 47.08, -92.89, -86.25],
	WY: [40.99, 45.01, -111.06, -104.05],
};

const US_STATE_NAME_TO_CODE: Record<string, string> = {
	alabama: "AL",
	alaska: "AK",
	arizona: "AZ",
	arkansas: "AR",
	california: "CA",
	colorado: "CO",
	connecticut: "CT",
	delaware: "DE",
	districtofcolumbia: "DC",
	florida: "FL",
	georgia: "GA",
	hawaii: "HI",
	idaho: "ID",
	illinois: "IL",
	indiana: "IN",
	iowa: "IA",
	kansas: "KS",
	kentucky: "KY",
	louisiana: "LA",
	maine: "ME",
	maryland: "MD",
	massachusetts: "MA",
	michigan: "MI",
	minnesota: "MN",
	mississippi: "MS",
	missouri: "MO",
	montana: "MT",
	nebraska: "NE",
	nevada: "NV",
	newhampshire: "NH",
	newjersey: "NJ",
	newmexico: "NM",
	newyork: "NY",
	northcarolina: "NC",
	northdakota: "ND",
	ohio: "OH",
	oklahoma: "OK",
	oregon: "OR",
	pennsylvania: "PA",
	rhodeisland: "RI",
	southcarolina: "SC",
	southdakota: "SD",
	tennessee: "TN",
	texas: "TX",
	utah: "UT",
	vermont: "VT",
	virginia: "VA",
	washington: "WA",
	westvirginia: "WV",
	wisconsin: "WI",
	wyoming: "WY",
};

/** Keeps border facilities inside the check without accepting another state. */
const STATE_BOUNDS_PADDING_DEG = 0.6;

function normalizeStateCode(state: string | null | undefined): string | null {
	const trimmed = state?.trim();
	if (!trimmed) return null;
	if (/^[A-Za-z]{2}$/.test(trimmed)) {
		const code = trimmed.toUpperCase();
		if (code === "AK" || US_STATE_BOUNDS[code]) return code;
		return null;
	}
	const key = trimmed.toLowerCase().replace(/[^a-z]/g, "");
	return US_STATE_NAME_TO_CODE[key] ?? null;
}

export function parseUsStateFromAddress(address: string): string | null {
	const text = address.trim();
	if (!text) return null;

	const withZip = text.match(/,\s*([A-Za-z]{2})\s+\d{5}(?:-\d{4})?\b/);
	if (withZip) {
		const code = normalizeStateCode(withZip[1]);
		if (code) return code;
	}

	const trailingCode = text.match(/,\s*([A-Za-z]{2})\s*$/);
	if (trailingCode) {
		const code = normalizeStateCode(trailingCode[1]);
		if (code) return code;
	}

	const trailingName = text.match(/,\s*([A-Za-z][A-Za-z .]+?)(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
	if (trailingName) {
		return normalizeStateCode(trailingName[1]);
	}

	return null;
}

export function coordinatesInUsState(lat: number, lng: number, state: string): boolean {
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

	const code = normalizeStateCode(state);
	if (!code) return true;

	if (code === "AK") {
		const mainland = lat >= 51 && lat <= 71.6 && lng >= -180 && lng <= -129;
		const aleutians = lat >= 51 && lat <= 55 && lng >= 170 && lng <= 180;
		return mainland || aleutians;
	}

	const box = US_STATE_BOUNDS[code];
	if (!box) return true;
	const [minLat, maxLat, minLng, maxLng] = box;
	const pad = STATE_BOUNDS_PADDING_DEG;
	return lat >= minLat - pad && lat <= maxLat + pad && lng >= minLng - pad && lng <= maxLng + pad;
}

/**
 * True when the point agrees with the first address that names a US state,
 * or with `stateCode` when no address contains one.
 * Addresses with no state do not reject the point.
 */
export function coordinatesPlausibleForAddresses(
	lat: number,
	lng: number,
	addresses: Array<string | null | undefined>,
	stateCode?: string | null
): boolean {
	for (const address of addresses) {
		if (!address) continue;
		const state = parseUsStateFromAddress(address);
		if (!state) continue;
		return coordinatesInUsState(lat, lng, state);
	}

	const fromField = normalizeStateCode(stateCode);
	if (fromField) return coordinatesInUsState(lat, lng, fromField);
	return true;
}

export function coordinatesPlausibleForLocation(
	lat: number,
	lng: number,
	address: string | null | undefined,
	stateCode?: string | null
): boolean {
	return coordinatesPlausibleForAddresses(lat, lng, [address], stateCode);
}
