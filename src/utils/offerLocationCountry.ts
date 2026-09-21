/** Nominatim / Zippopotam country for North America offer route geocoding. */
export type OfferGeocodeCountry = "us" | "ca" | "mx";

/** US ZIP: 5 digits, optionally +4 */
export const US_ZIP_PATTERN = /^\d{5}(-\d{4})?$/;

/** Canadian postal code (FSA or full, with optional space). */
export const CA_POSTAL_PATTERN = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;

/** Mexican CP: 5 digits (same shape as US ZIP). */
export const MX_CP_PATTERN = /^\d{5}$/;

const US_STATE_CODES = new Set([
	"AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
	"IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
	"NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
	"VT", "VA", "WA", "WV", "WI", "WY",
]);

const CA_PROVINCE_CODES = new Set([
	"AB", "BC", "MB", "NB", "NL", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT",
]);

const MX_STATE_CODES = new Set([
	"DIF", "CDMX", "AGU", "BCN", "BCS", "CAM", "CHP", "CHIS", "CHH", "COA", "COL", "DUR", "GUA",
	"GRO", "HID", "JAL", "MIC", "MOR", "MEX", "NAY", "NLE", "OAX", "PUE", "QUE", "QRO", "NAQ",
	"ROO", "SLP", "SIN", "SON", "TAB", "TAM", "TLA", "VER", "YUC", "ZAC",
]);

export const US_STATE_ABBR_TO_NAME: Record<string, string> = {
	AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
	CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
	HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
	KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
	MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
	MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
	NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
	OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
	SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
	VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
	DC: "District of Columbia",
};

export const CA_PROVINCE_ABBR_TO_NAME: Record<string, string> = {
	AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
	NL: "Newfoundland and Labrador", NT: "Northwest Territories", NS: "Nova Scotia",
	NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
	SK: "Saskatchewan", YT: "Yukon",
};

export const MX_STATE_ABBR_TO_NAME: Record<string, string> = {
	DIF: "Ciudad de México", CDMX: "Ciudad de México", AGU: "Aguascalientes",
	BCN: "Baja California", BCS: "Baja California Sur", CAM: "Campeche", CHP: "Chiapas",
	CHIS: "Chiapas", CHH: "Chihuahua", COA: "Coahuila", COL: "Colima", DUR: "Durango",
	GUA: "Guanajuato", GRO: "Guerrero", HID: "Hidalgo", JAL: "Jalisco", MIC: "Michoacán",
	MOR: "Morelos", MEX: "México", NAY: "Nayarit", NLE: "Nuevo León", OAX: "Oaxaca",
	PUE: "Puebla", QUE: "Querétaro", QRO: "Querétaro", NAQ: "Querétaro", ROO: "Quintana Roo",
	SLP: "San Luis Potosí", SIN: "Sinaloa", SON: "Sonora", TAB: "Tabasco", TAM: "Tamaulipas",
	TLA: "Tlaxcala", VER: "Veracruz", YUC: "Yucatán", ZAC: "Zacatecas",
};

/** "City, ST" (2 letters) or "City, JAL" (3–4 letters). */
export const CITY_REGION_CODE_PATTERN = /^([^,]+),\s*([A-Za-z]{2,4})\s*$/;

function countryFromRegionCode(code: string): OfferGeocodeCountry | null {
	const upper = code.toUpperCase();
	if (CA_PROVINCE_CODES.has(upper)) return "ca";
	if (MX_STATE_CODES.has(upper)) return "mx";
	if (US_STATE_CODES.has(upper)) return "us";
	return null;
}

function extractTrailingRegionCode(value: string): string | null {
	const commaMatch = /^[^,]+,\s*([A-Za-z]{2,4})\s*$/.exec(value.trim());
	if (commaMatch) {
		return commaMatch[1].toUpperCase();
	}

	const parts = value.trim().split(/\s+/);
	if (parts.length < 2) return null;
	const last = parts[parts.length - 1];
	if (/^[A-Za-z]{2,4}$/.test(last)) {
		return last.toUpperCase();
	}
	return null;
}

function countryFromRegionName(value: string): OfferGeocodeCountry | null {
	const lower = value.toLowerCase();
	for (const name of Object.values(CA_PROVINCE_ABBR_TO_NAME)) {
		if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
			return "ca";
		}
	}
	for (const name of Object.values(MX_STATE_ABBR_TO_NAME)) {
		if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
			return "mx";
		}
	}
	for (const name of Object.values(US_STATE_ABBR_TO_NAME)) {
		if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower)) {
			return "us";
		}
	}
	return null;
}

/** Normalize postal input: "N7M, 1A1" → "N7M 1A1", trim, uppercase Canadian codes. */
export function normalizePostalInput(value: string): string {
	const trimmed = value.trim();
	const caComma = /^([A-Za-z]\d[A-Za-z])\s*,\s*(\d[A-Za-z]\d)$/i.exec(trimmed);
	if (caComma) {
		return `${caComma[1].toUpperCase()} ${caComma[2].toUpperCase()}`;
	}
	if (/^[A-Za-z]\d[A-Za-z]$/i.test(trimmed)) {
		return trimmed.toUpperCase();
	}
	return trimmed;
}

const COUNTRY_LABELS = new Set([
	"usa",
	"us",
	"u.s",
	"u.s.",
	"u.s.a",
	"u.s.a.",
	"united states",
	"united states of america",
	"canada",
	"mexico",
	"méxico",
]);

function isCountryLabel(token: string): boolean {
	const key = token
		.trim()
		.replace(/[.,;]+$/g, "")
		.toLowerCase()
		.replace(/\s+/g, " ");
	if (!key) return false;
	if (COUNTRY_LABELS.has(key)) return true;
	const collapsed = key.replace(/\./g, "");
	return collapsed === "usa" || collapsed === "us";
}

function stripTrailingCountryLabel(value: string): string {
	let next = value.trim();
	for (let i = 0; i < 3; i++) {
		const commaIdx = next.lastIndexOf(",");
		if (commaIdx > 0) {
			const lastSeg = next.slice(commaIdx + 1).trim();
			if (isCountryLabel(lastSeg)) {
				next = next.slice(0, commaIdx).replace(/[,\s]+$/g, "").trim();
				continue;
			}
		}
		const spaceMatch = /^(.*?)[\s,]+([A-Za-z.]+)\.?$/.exec(next);
		if (spaceMatch && isCountryLabel(spaceMatch[2])) {
			next = spaceMatch[1].trim();
			continue;
		}
		break;
	}
	return next;
}

function replacePeriodBeforeRegionCode(value: string): string {
	return value.replace(/\.(\s*)([A-Za-z]{2,4})\b/g, (full, space: string, code: string) => {
		if (!countryFromRegionCode(code.toUpperCase())) return full;
		return `,${space || " "}${code}`;
	});
}

function collapseExtraLocationCommas(value: string): string {
	const parts = value
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length <= 1) return value.trim();
	if (parts.length === 2) return `${parts[0]}, ${parts[1]}`;
	return `${parts[0]}, ${parts.slice(1).join(" ")}`;
}

function stripCityTrailingPunctuation(value: string): string {
	const commaIdx = value.indexOf(",");
	if (commaIdx <= 0) {
		return value.replace(/[.,;:\s]+$/g, "").trim();
	}
	const city = value.slice(0, commaIdx).replace(/[.,;:\s]+$/g, "").trim();
	const rest = value.slice(commaIdx + 1).trim();
	if (!city) return value.trim();
	return rest ? `${city}, ${rest}` : city;
}

/**
 * Canonicalize typed offer locations so geocoding accepts common variants:
 * "BENZONIA, MI, 49616" / "BENZONIA, MI, 49616 USA" / "BENZONIA. MI".
 */
export function canonicalizeOfferLocation(value: string): string {
	let next = normalizePostalInput(value.trim().replace(/\s+/g, " "));
	if (!next) return next;
	if (isBarePostalInput(next)) {
		if (isCanadianPostalCode(next)) {
			return next.replace(/\s+/g, " ").trim().toUpperCase();
		}
		return next;
	}

	next = stripTrailingCountryLabel(next);
	next = next.replace(/[,\s]+$/g, "").trim();
	next = replacePeriodBeforeRegionCode(next);
	next = collapseExtraLocationCommas(next);
	next = stripCityTrailingPunctuation(next);
	return next.replace(/\s+/g, " ").trim();
}

export function isCanadianPostalCode(value: string): boolean {
	const normalized = normalizePostalInput(value);
	return (
		CA_POSTAL_PATTERN.test(normalized.replace(/\s+/g, " ").trim()) ||
		/^[A-Z]\d[A-Z]$/i.test(normalized)
	);
}

/** True when the value is only a postal/ZIP code (no city name). */
export function isBarePostalInput(value: string): boolean {
	const normalized = normalizePostalInput(value.trim());
	const compact = normalized.replace(/\s/g, "");
	if (isCanadianPostalCode(normalized)) return true;
	if (US_ZIP_PATTERN.test(compact)) return true;
	return MX_CP_PATTERN.test(compact);
}

export function isUsZipCode(value: string): boolean {
	return US_ZIP_PATTERN.test(value.replace(/\s/g, ""));
}

export function isMexicanCpCode(value: string): boolean {
	return MX_CP_PATTERN.test(value.replace(/\s/g, ""));
}

/**
 * Infer Nominatim / Zippopotam country from free-text offer location.
 * Defaults to US when ambiguous (e.g. bare 5-digit postal code).
 */
export function resolveOfferGeocodeCountry(address: string): OfferGeocodeCountry {
	const trimmed = address.trim();
	if (!trimmed) return "us";

	if (/\bcanada\b/i.test(trimmed)) return "ca";
	if (/\b(mexico|méxico)\b/i.test(trimmed)) return "mx";
	if (/\b(usa|united states|u\.s\.a\.)\b/i.test(trimmed)) return "us";

	const compact = trimmed.replace(/\s/g, "");
	if (isCanadianPostalCode(trimmed)) return "ca";

	const fromName = countryFromRegionName(trimmed);
	if (fromName) return fromName;

	const cityRegionPostal = /,\s*([A-Za-z]{2,4})\s+[A-Z0-9]/i.exec(trimmed);
	if (cityRegionPostal) {
		const fromCode = countryFromRegionCode(cityRegionPostal[1].toUpperCase());
		if (fromCode) return fromCode;
	}

	const regionCode = extractTrailingRegionCode(trimmed);
	if (regionCode) {
		const fromCode = countryFromRegionCode(regionCode);
		if (fromCode) return fromCode;
	}

	if (MX_CP_PATTERN.test(compact) && regionCode && MX_STATE_CODES.has(regionCode)) {
		return "mx";
	}

	return "us";
}

export function nominatimCountryLabel(country: OfferGeocodeCountry): string {
	return { us: "USA", ca: "Canada", mx: "Mexico" }[country];
}

export function buildNominatimQuery(address: string, country: OfferGeocodeCountry): string {
	const expanded = expandPlaceAbbreviations(address.trim());
	const label = nominatimCountryLabel(country);
	if (new RegExp(`\\b${label}\\b`, "i").test(expanded)) {
		return expanded;
	}
	return `${expanded}, ${label}`;
}

export function regionCodeToFullName(code: string, country: OfferGeocodeCountry): string {
	const upper = code.toUpperCase();
	switch (country) {
		case "ca":
			return CA_PROVINCE_ABBR_TO_NAME[upper] ?? upper;
		case "mx":
			return MX_STATE_ABBR_TO_NAME[upper] ?? upper;
		default:
			return US_STATE_ABBR_TO_NAME[upper] ?? upper;
	}
}

export function zippopotamUrl(
	country: OfferGeocodeCountry,
	regionCode: string,
	city: string,
): string {
	const countryPath = country;
	const regionPath = regionCode.toLowerCase();
	return `https://api.zippopotam.us/${countryPath}/${encodeURIComponent(regionPath)}/${encodeURIComponent(expandPlaceAbbreviations(city))}`;
}

export function zippopotamPostalUrl(
	country: OfferGeocodeCountry,
	postalCode: string,
): string | null {
	const compact = postalCode.replace(/\s/g, "").toUpperCase();
	if (country === "ca" && /^[A-Z]\d[A-Z](\d[A-Z]\d)?$/.test(compact)) {
		const fsa = compact.slice(0, 3);
		return `https://api.zippopotam.us/ca/${encodeURIComponent(fsa)}`;
	}
	if (country === "us" && US_ZIP_PATTERN.test(compact)) {
		return `https://api.zippopotam.us/us/${encodeURIComponent(compact.slice(0, 5))}`;
	}
	if (country === "mx" && MX_CP_PATTERN.test(compact)) {
		return `https://api.zippopotam.us/mx/${encodeURIComponent(compact)}`;
	}
	return null;
}

export function parseCityRegionCode(
	address: string,
): { city: string; regionCode: string; country: OfferGeocodeCountry } | null {
	const match = CITY_REGION_CODE_PATTERN.exec(canonicalizeOfferLocation(address));
	if (!match) return null;

	const city = match[1].trim();
	const regionCode = match[2].toUpperCase();
	const country = countryFromRegionCode(regionCode);
	if (!country || !city) return null;

	return { city, regionCode, country };
}

/** "City, AB T5A" / "Phoenix, AZ 85001" / "Wauseon, Ohio 43567" — after geocode-to-formatted. */
export function parseCityRegionPostalLine(
	address: string,
): {
	city: string;
	regionCode: string;
	postal: string;
	country: OfferGeocodeCountry;
} | null {
	const trimmed = canonicalizeOfferLocation(address);
	const commaIdx = trimmed.indexOf(",");
	if (commaIdx <= 0) return null;

	const city = trimmed.slice(0, commaIdx).trim();
	const afterComma = trimmed.slice(commaIdx + 1).trim();
	if (!city || !afterComma) return null;

	let postal: string | null = null;
	let regionToken: string | null = null;

	const caMatch = afterComma.match(
		/^(.+?)[,\s]+([A-Z]\d[A-Z](?:\s?\d[A-Z]\d)?)\b/i,
	);
	if (caMatch) {
		regionToken = caMatch[1].trim();
		postal = caMatch[2].replace(/\s+/g, " ").trim().toUpperCase();
	} else {
		const zipMatch = afterComma.match(/^(.+?)[,\s]+(\d{5}(?:-\d{4})?)\b/);
		if (zipMatch) {
			regionToken = zipMatch[1].trim();
			postal = zipMatch[2];
		}
	}

	if (!regionToken || !postal) return null;

	const regionResolved = resolveRegionToken(regionToken);
	if (!regionResolved) return null;

	return {
		city,
		regionCode: regionResolved.regionCode,
		postal,
		country: regionResolved.country,
	};
}

export function lettersOnlyKey(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z]/g, "");
}

/** True when two place names refer to the same city (ignores punctuation / "St" vs "Saint" / "Vlg" vs "Village"). */
export function placeNamesMatch(a: string, b: string): boolean {
	const left = lettersOnlyKey(expandPlaceAbbreviations(a));
	const right = lettersOnlyKey(expandPlaceAbbreviations(b));
	if (!left || !right) return false;
	if (left === right) return true;
	const shorter = left.length <= right.length ? left : right;
	const longer = left.length <= right.length ? right : left;
	return shorter.length >= 4 && longer.includes(shorter);
}

function expandPlaceAbbreviations(value: string): string {
	return value
		.replace(/\bSt\.?\b/gi, "Saint")
		.replace(/\bFt\.?\b/gi, "Fort")
		.replace(/\bMt\.?\b/gi, "Mount")
		.replace(/\bVlg\.?\b/gi, "Village");
}

/**
 * City + region from "City, ST", "City, ST ZIP", or "City, State ZIP".
 * Used to verify the place exists — do not geocode by ZIP alone when a city is present.
 */
export function parseCityRegionFromAddress(
	address: string,
): { city: string; regionCode: string; country: OfferGeocodeCountry } | null {
	const trimmed = canonicalizeOfferLocation(address);
	if (!trimmed) return null;

	const direct = parseCityRegionCode(trimmed);
	if (direct) return direct;

	const line = parseCityRegionPostalLine(trimmed);
	if (line) {
		return { city: line.city, regionCode: line.regionCode, country: line.country };
	}

	return null;
}

const REGION_NAME_TO_CODE: Record<string, { regionCode: string; country: OfferGeocodeCountry }> =
	(() => {
		const out: Record<string, { regionCode: string; country: OfferGeocodeCountry }> = {};
		for (const [code, name] of Object.entries(US_STATE_ABBR_TO_NAME)) {
			out[lettersOnlyKey(name)] = { regionCode: code, country: "us" };
		}
		for (const [code, name] of Object.entries(CA_PROVINCE_ABBR_TO_NAME)) {
			out[lettersOnlyKey(name)] = { regionCode: code, country: "ca" };
		}
		for (const [code, name] of Object.entries(MX_STATE_ABBR_TO_NAME)) {
			out[lettersOnlyKey(name)] = { regionCode: code, country: "mx" };
		}
		return out;
	})();

function resolveRegionToken(
	token: string,
): { regionCode: string; country: OfferGeocodeCountry } | null {
	const cleaned = token.trim().replace(/[.,;]+/g, " ").replace(/\s+/g, " ").trim();
	const upper = cleaned.toUpperCase();
	const fromCode = countryFromRegionCode(upper);
	if (fromCode) return { regionCode: upper, country: fromCode };

	const fromName = REGION_NAME_TO_CODE[lettersOnlyKey(cleaned)];
	if (fromName) return fromName;

	return null;
}
