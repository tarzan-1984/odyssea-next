import {
	buildNominatimQuery,
	CA_POSTAL_PATTERN,
	CITY_REGION_CODE_PATTERN,
	isCanadianPostalCode,
	isBarePostalInput,
	isUsZipCode,
	lettersOnlyKey,
	MX_CP_PATTERN,
	nominatimCountryLabel,
	canonicalizeOfferLocation,
	parseCityRegionFromAddress,
	parseCityRegionPostalLine,
	placeNamesMatch,
	regionCodeToFullName,
	resolveOfferGeocodeCountry,
	type OfferGeocodeCountry,
	US_ZIP_PATTERN,
	zippopotamPostalUrl,
	zippopotamUrl,
} from "./offerLocationCountry";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

type NominatimAddress = {
	city?: string;
	town?: string;
	village?: string;
	municipality?: string;
	hamlet?: string;
	state?: string;
	postcode?: string;
};

function nominatimPlaceName(addr?: NominatimAddress): string {
	return (
		addr?.city ??
		addr?.town ??
		addr?.village ??
		addr?.municipality ??
		addr?.hamlet ??
		""
	).trim();
}

function cityFromNominatimAddress(addr: NominatimAddress, fallback: string): string {
	const resolved = nominatimPlaceName(addr);
	if (!resolved) return "";
	return simplifyPlaceName(resolved, fallback);
}

function regionNameMatchesCode(
	regionName: string,
	regionCode: string,
	country: OfferGeocodeCountry,
): boolean {
	const nameKey = lettersOnlyKey(regionName);
	if (!nameKey) return false;
	if (nameKey === lettersOnlyKey(regionCode)) return true;
	return nameKey === lettersOnlyKey(regionCodeToFullName(regionCode, country));
}

function postalMatchesStatedCity(
	city: string,
	regionCode: string,
	country: OfferGeocodeCountry,
	zipp: { placeName: string; regionName: string; regionCode?: string },
): boolean {
	if (!placeNamesMatch(city, zipp.placeName)) return false;
	if (zipp.regionCode && zipp.regionCode.toUpperCase() === regionCode.toUpperCase()) {
		return true;
	}
	return regionNameMatchesCode(zipp.regionName, regionCode, country);
}

function zipRegionMatches(
	regionCode: string,
	country: OfferGeocodeCountry,
	zipp: { regionName: string; regionCode?: string },
): boolean {
	if (zipp.regionCode && zipp.regionCode.toUpperCase() === regionCode.toUpperCase()) {
		return true;
	}
	return regionNameMatchesCode(zipp.regionName, regionCode, country);
}

function compactPostal(postal: string): string {
	return postal.replace(/\s/g, "").replace(/-\d{4}$/, "").toUpperCase();
}

/**
 * Strip Zippopotam district suffixes in parentheses.
 * e.g. "Edmonton (West Clareview / East Londonderry)" → "Edmonton"
 */
export function simplifyPlaceName(placeName: string, preferredCity?: string): string {
	const trimmed = placeName.trim();
	if (!trimmed) return preferredCity?.trim() ?? "";

	const withoutParens = trimmed.replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
	const pref = preferredCity?.trim();

	if (pref) {
		const lowerPref = pref.toLowerCase();
		const candidate = withoutParens || trimmed;
		if (candidate.toLowerCase() === lowerPref || candidate.toLowerCase().startsWith(`${lowerPref} `)) {
			return pref;
		}
	}

	return withoutParens || trimmed;
}

function nominatimHeaders(userAgent: string): Record<string, string> {
	return {
		"User-Agent": userAgent,
		"Accept-Language": "en",
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchNominatim(
	query: string,
	country: OfferGeocodeCountry,
	options: { limit?: string; addressdetails?: string; userAgent: string },
): Promise<Array<{ lat?: string; lon?: string; address?: NominatimAddress }>> {
	const params = new URLSearchParams({
		q: query,
		format: "json",
		limit: options.limit ?? "1",
		countrycodes: country,
	});
	if (options.addressdetails) {
		params.set("addressdetails", options.addressdetails);
	}

	const doFetch = async (): Promise<{
		status: number;
		ok: boolean;
		data: Array<{ lat?: string; lon?: string; address?: NominatimAddress }>;
	}> => {
		const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
			headers: nominatimHeaders(options.userAgent),
		});
		if (!res.ok) return { status: res.status, ok: false, data: [] };
		const data = (await res.json()) as Array<{
			lat?: string;
			lon?: string;
			address?: NominatimAddress;
		}>;
		return { status: res.status, ok: true, data: Array.isArray(data) ? data : [] };
	};

	let result = await doFetch();
	if (!result.ok && (result.status === 429 || result.status === 503)) {
		await sleep(1100);
		result = await doFetch();
	}
	return result.data;
}

async function tryZippopotamCityRegion(
	city: string,
	regionCode: string,
	country: OfferGeocodeCountry,
): Promise<{ placeName: string; postal: string } | null> {
	try {
		const zippRes = await fetch(zippopotamUrl(country, regionCode, city), {
			headers: { Accept: "application/json" },
		});
		if (!zippRes.ok) return null;

		const zippData = (await zippRes.json()) as {
			places?: Array<{ "post code"?: string; "place name"?: string }>;
		};
		const firstPlace = zippData.places?.[0];
		const postal = firstPlace?.["post code"];
		if (!postal) return null;

		return {
			placeName: simplifyPlaceName(firstPlace?.["place name"] ?? city, city),
			postal,
		};
	} catch {
		return null;
	}
}

async function tryZippopotamPostal(
	postalInput: string,
	country: OfferGeocodeCountry,
): Promise<{
	placeName: string;
	regionName: string;
	regionCode: string;
	postal: string;
	lat?: number;
	lon?: number;
	places: Array<{
		placeName: string;
		regionName: string;
		regionCode: string;
		lat?: number;
		lon?: number;
	}>;
} | null> {
	const url = zippopotamPostalUrl(country, postalInput);
	if (!url) return null;

	try {
		const zippRes = await fetch(url, { headers: { Accept: "application/json" } });
		if (!zippRes.ok) return null;

		const zippData = (await zippRes.json()) as {
			"place name"?: string;
			state?: string;
			"state abbreviation"?: string;
			places?: Array<{
				"place name"?: string;
				"post code"?: string;
				state?: string;
				"state abbreviation"?: string;
				latitude?: string;
				longitude?: string;
			}>;
		};
		const places = (zippData.places ?? []).map((place) => {
			const lat = place.latitude != null ? Number.parseFloat(place.latitude) : undefined;
			const lon = place.longitude != null ? Number.parseFloat(place.longitude) : undefined;
			return {
				placeName: simplifyPlaceName(place["place name"] ?? ""),
				regionName: place.state ?? zippData.state ?? "",
				regionCode: (place["state abbreviation"] ?? zippData["state abbreviation"] ?? "").toUpperCase(),
				lat: lat != null && Number.isFinite(lat) ? lat : undefined,
				lon: lon != null && Number.isFinite(lon) ? lon : undefined,
			};
		});
		const firstPlace = places[0];
		const postal =
			zippData.places?.[0]?.["post code"] ??
			postalInput.replace(/\s/g, "").toUpperCase();
		const placeName = firstPlace?.placeName ?? simplifyPlaceName(zippData["place name"] ?? "");
		const regionName = firstPlace?.regionName ?? zippData.state ?? "";
		const regionCode = firstPlace?.regionCode ?? (zippData["state abbreviation"] ?? "").toUpperCase();
		if (!placeName && !regionName && places.length === 0) return null;

		const inputCompact = postalInput.replace(/\s/g, "").toUpperCase();
		const displayPostal =
			country === "ca" && /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(inputCompact)
				? `${inputCompact.slice(0, 3)} ${inputCompact.slice(3)}`
				: postal;

		return {
			placeName,
			regionName,
			regionCode,
			postal: displayPostal,
			lat: firstPlace?.lat,
			lon: firstPlace?.lon,
			places,
		};
	} catch {
		return null;
	}
}

async function zippopotamCityIncludesPostal(
	city: string,
	regionCode: string,
	country: OfferGeocodeCountry,
	postal: string,
): Promise<boolean> {
	try {
		const zippRes = await fetch(zippopotamUrl(country, regionCode, city), {
			headers: { Accept: "application/json" },
		});
		if (!zippRes.ok) return false;
		const data = (await zippRes.json()) as {
			places?: Array<{ "post code"?: string }>;
		};
		const wanted = compactPostal(postal);
		return (data.places ?? []).some(
			(place) => compactPostal(place["post code"] ?? "") === wanted,
		);
	} catch {
		return false;
	}
}

async function coordsFromZippopotamCityRegion(
	city: string,
	regionCode: string,
	country: OfferGeocodeCountry,
): Promise<{ lat: number; lon: number } | null> {
	try {
		const zippRes = await fetch(zippopotamUrl(country, regionCode, city), {
			headers: { Accept: "application/json" },
		});
		if (!zippRes.ok) return null;

		const data = (await zippRes.json()) as {
			places?: Array<{ latitude?: string; longitude?: string }>;
		};
		const place = data.places?.find((p) => p.latitude != null && p.longitude != null) ?? data.places?.[0];
		if (!place?.latitude || !place?.longitude) return null;

		const lat = Number.parseFloat(place.latitude);
		const lon = Number.parseFloat(place.longitude);
		if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
		return { lat, lon };
	} catch {
		return null;
	}
}

function extractEmbeddedPostal(
	address: string,
	country: OfferGeocodeCountry,
): { postal: string; country: OfferGeocodeCountry } | null {
	const trimmed = address.trim();
	const caMatch = trimmed.match(/\b([A-Z]\d[A-Z](?:\s?\d[A-Z]\d)?)\b/i);
	if (caMatch) {
		return { postal: caMatch[1], country: "ca" };
	}
	const digitMatch = trimmed.match(/\b(\d{5})(?:-\d{4})?\b/);
	if (digitMatch) {
		const compact = digitMatch[1];
		if (country === "mx" || country === "us") {
			return { postal: compact, country };
		}
		return { postal: compact, country: "us" };
	}
	return null;
}

async function coordsFromFormattedLine(
	line: ReturnType<typeof parseCityRegionPostalLine>,
): Promise<{ lat: number; lon: number } | null> {
	if (!line) return null;

	const zipp = await tryZippopotamPostal(line.postal, line.country);
	if (!zipp) return null;

	const matchedPlace =
		zipp.places.find((place) =>
			postalMatchesStatedCity(line.city, line.regionCode, line.country, place),
		) ??
		(postalMatchesStatedCity(line.city, line.regionCode, line.country, zipp)
			? zipp
			: null);

	if (matchedPlace?.lat != null && matchedPlace.lon != null) {
		return { lat: matchedPlace.lat, lon: matchedPlace.lon };
	}

	const cityOwnsPostal = await zippopotamCityIncludesPostal(
		line.city,
		line.regionCode,
		line.country,
		line.postal,
	);
	if (cityOwnsPostal && zipp.lat != null && zipp.lon != null) {
		return { lat: zipp.lat, lon: zipp.lon };
	}

	// Airport / suburb ZIPs often use a parent-city name (60666 → "Amf Ohare",
	// 30337 → "Atlanta" while the municipality is College Park). Zippopotam
	// also omits many real cities, so do not require a city directory hit —
	// a ZIP in the stated state is enough to pin coordinates.
	if (zipRegionMatches(line.regionCode, line.country, zipp) && zipp.lat != null && zipp.lon != null) {
		return { lat: zipp.lat, lon: zipp.lon };
	}

	return null;
}

async function coordsFromNominatimCity(
	city: string,
	regionCode: string,
	country: OfferGeocodeCountry,
	userAgent: string,
): Promise<{ lat: number; lon: number } | null> {
	const query = buildNominatimQuery(`${city}, ${regionCode}`, country);
	const results = await fetchNominatim(query, country, {
		limit: "5",
		addressdetails: "1",
		userAgent,
	});
	const match =
		results.find(
			(result) =>
				result.lat &&
				result.lon &&
				placeNamesMatch(city, nominatimPlaceName(result.address)),
		) ??
		results.find(
			(result) =>
				result.lat &&
				result.lon &&
				!!result.address?.state &&
				regionNameMatchesCode(result.address.state, regionCode, country),
		);
	if (!match?.lat || !match.lon) return null;

	const lat = Number.parseFloat(match.lat);
	const lon = Number.parseFloat(match.lon);
	if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
	return { lat, lon };
}

function formatZippopotamPostalResult(
	zipp: { placeName: string; regionName: string; postal: string },
	preferredCity?: string,
): string {
	const city = simplifyPlaceName(zipp.placeName, preferredCity);
	const region = zipp.regionName.trim();
	const postal = zipp.postal.trim();
	if (city && region && postal) {
		return `${city}, ${region} ${postal}`;
	}
	if (city && postal) {
		return `${city} ${postal}`;
	}
	return postal;
}

/** Resolve bare 5-digit postal: try US Zippopotam first, then Mexico. */
async function geocodeBareFiveDigitPostal(
	postal: string,
): Promise<{ formatted: string; country: OfferGeocodeCountry } | null> {
	const compact = postal.replace(/\s/g, "");
	if (!MX_CP_PATTERN.test(compact)) return null;

	for (const country of ["us", "mx"] as const) {
		const zipp = await tryZippopotamPostal(compact, country);
		if (zipp) {
			return { formatted: formatZippopotamPostalResult(zipp), country };
		}
	}
	return null;
}

async function geocodeFreeTextToFormatted(
	trimmed: string,
	userAgent: string,
): Promise<string | null> {
	const country = resolveOfferGeocodeCountry(trimmed);
	const expectedCity = parseCityRegionFromAddress(trimmed)?.city ?? "";
	const query = buildNominatimQuery(trimmed, country);
	const results = await fetchNominatim(query, country, {
		limit: "5",
		addressdetails: "1",
		userAgent,
	});
	const withPostal = results.find((result) => {
		if (!result.address?.postcode) return false;
		const city = nominatimPlaceName(result.address);
		if (!city) return false;
		return !expectedCity || placeNamesMatch(expectedCity, city);
	});
	if (!withPostal?.address?.postcode) return null;

	const addr = withPostal.address;
	const city = cityFromNominatimAddress(addr, expectedCity);
	if (!city) return null;
	const state = addr.state ?? "";
	const postcode = addr.postcode;
	if (city && state && postcode) {
		return `${city}, ${state} ${postcode}`;
	}
	if (city && postcode) {
		return `${city} ${postcode}`;
	}
	return null;
}

/** Geocode address via Nominatim. Returns lat/lon or null. */
export async function geocodeOfferAddressCoordinates(
	address: string,
	userAgent = "OdysseaApp/1.0 (geocode-coordinates)",
): Promise<{ lat: number; lon: number } | null> {
	const trimmed = canonicalizeOfferLocation(address);
	if (!trimmed) return null;

	const country = resolveOfferGeocodeCountry(trimmed);
	const cityRegion = parseCityRegionFromAddress(trimmed);
	const formattedLine = parseCityRegionPostalLine(trimmed);

	if (formattedLine) {
		const fromLine = await coordsFromFormattedLine(formattedLine);
		if (fromLine) return fromLine;
	}

	if (cityRegion) {
		const coords = await coordsFromZippopotamCityRegion(
			cityRegion.city,
			cityRegion.regionCode,
			cityRegion.country,
		);
		if (coords) return coords;
		const fromNominatim = await coordsFromNominatimCity(
			cityRegion.city,
			cityRegion.regionCode,
			cityRegion.country,
			userAgent,
		);
		if (fromNominatim) return fromNominatim;
	}

	const compact = trimmed.replace(/\s/g, "");
	if (MX_CP_PATTERN.test(compact) && isBarePostalInput(trimmed)) {
		const bare = await geocodeBareFiveDigitPostal(trimmed);
		if (bare) {
			const zipp = await tryZippopotamPostal(compact, bare.country);
			if (zipp?.lat != null && zipp.lon != null) {
				return { lat: zipp.lat, lon: zipp.lon };
			}
		}
	}

	if (isBarePostalInput(trimmed)) {
		const embeddedPostal = extractEmbeddedPostal(trimmed, country);
		if (embeddedPostal) {
			const zipp = await tryZippopotamPostal(embeddedPostal.postal, embeddedPostal.country);
			if (zipp?.lat != null && zipp.lon != null) {
				return { lat: zipp.lat, lon: zipp.lon };
			}
		}
	}

	const query = buildNominatimQuery(trimmed, country);
	const results = await fetchNominatim(query, country, {
		limit: "5",
		addressdetails: "1",
		userAgent,
	});
	const first = results[0];
	if (!first?.lat || !first?.lon) return null;

	const lat = Number.parseFloat(first.lat);
	const lon = Number.parseFloat(first.lon);
	if (Number.isNaN(lat) || Number.isNaN(lon)) return null;

	return { lat, lon };
}

/**
 * Geocode ZIP / "City, ST" / Canadian postal / Mexican CP to formatted location string.
 * Returns empty string when the stated city cannot be verified.
 */
export async function geocodeOfferToFormattedAddress(
	input: string,
	userAgent = "OdysseaApp/1.0 (geocode-formatted)",
): Promise<string> {
	const trimmed = canonicalizeOfferLocation(input);
	if (!trimmed) return trimmed;

	const compact = trimmed.replace(/\s/g, "");
	const isCaPostal = isCanadianPostalCode(trimmed);
	const isFiveDigit = MX_CP_PATTERN.test(compact);
	const isUsPostal = isUsZipCode(trimmed);
	const cityRegion = parseCityRegionFromAddress(trimmed);
	const formattedLine = parseCityRegionPostalLine(trimmed);

	if (formattedLine) {
		const postalHit = await tryZippopotamPostal(formattedLine.postal, formattedLine.country);
		const nameMatch =
			postalHit != null &&
			(postalHit.places.some((place) =>
				postalMatchesStatedCity(
					formattedLine.city,
					formattedLine.regionCode,
					formattedLine.country,
					place,
				),
			) ||
				postalMatchesStatedCity(
					formattedLine.city,
					formattedLine.regionCode,
					formattedLine.country,
					postalHit,
				));
		const cityOwnsPostal =
			postalHit != null &&
			(await zippopotamCityIncludesPostal(
				formattedLine.city,
				formattedLine.regionCode,
				formattedLine.country,
				formattedLine.postal,
			));
		const sameRegion =
			postalHit != null &&
			zipRegionMatches(formattedLine.regionCode, formattedLine.country, postalHit);

		if (postalHit && (nameMatch || cityOwnsPostal || sameRegion)) {
			const displayCity = nameMatch
				? simplifyPlaceName(postalHit.placeName, formattedLine.city)
				: simplifyPlaceName(formattedLine.city);
			return `${displayCity}, ${formattedLine.regionCode} ${formattedLine.postal}`;
		}

		const cityHit = await tryZippopotamCityRegion(
			formattedLine.city,
			formattedLine.regionCode,
			formattedLine.country,
		);
		if (cityHit) {
			return `${simplifyPlaceName(cityHit.placeName, formattedLine.city)}, ${formattedLine.regionCode} ${formattedLine.postal}`;
		}

		const fromNominatim = await coordsFromNominatimCity(
			formattedLine.city,
			formattedLine.regionCode,
			formattedLine.country,
			userAgent,
		);
		if (fromNominatim) {
			return `${simplifyPlaceName(formattedLine.city)}, ${formattedLine.regionCode} ${formattedLine.postal}`;
		}

		return "";
	}

	if (cityRegion) {
		const { city, regionCode, country: regionCountry } = cityRegion;

		const zipp = await tryZippopotamCityRegion(city, regionCode, regionCountry);
		if (zipp) {
			return `${simplifyPlaceName(zipp.placeName, city)}, ${regionCode} ${zipp.postal}`;
		}

		const query = buildNominatimQuery(`${city}, ${regionCode}`, regionCountry);
		const results = await fetchNominatim(query, regionCountry, {
			limit: "5",
			addressdetails: "1",
			userAgent,
		});
		const withPostal = results.find(
			(result) =>
				result.address?.postcode &&
				placeNamesMatch(city, nominatimPlaceName(result.address)),
		);
		if (withPostal?.address?.postcode) {
			const resolvedCity = cityFromNominatimAddress(withPostal.address, city);
			if (resolvedCity) {
				return `${resolvedCity}, ${regionCode} ${withPostal.address.postcode}`;
			}
		}

		return "";
	}

	if (isCaPostal && isBarePostalInput(trimmed)) {
		const zipp = await tryZippopotamPostal(trimmed, "ca");
		if (zipp) {
			return formatZippopotamPostalResult(zipp);
		}
	}

	if (isFiveDigit && isBarePostalInput(trimmed)) {
		const bare = await geocodeBareFiveDigitPostal(trimmed);
		if (bare) return bare.formatted;
	}

	if (isUsPostal && isBarePostalInput(trimmed)) {
		const zipp = await tryZippopotamPostal(trimmed, "us");
		if (zipp) {
			return formatZippopotamPostalResult(zipp);
		}

		const query = buildNominatimQuery(trimmed, "us");
		const results = await fetchNominatim(query, "us", {
			limit: "1",
			addressdetails: "1",
			userAgent,
		});

		if (results.length > 0 && results[0].address) {
			const addr = results[0].address!;
			const city = cityFromNominatimAddress(addr, "");
			const state = addr.state ?? "";
			const postcode = addr.postcode ?? trimmed;
			if (city && state && postcode) {
				return `${city}, ${state} ${postcode}`;
			}
			if (city && state) {
				return `${city}, ${state}`;
			}
		}
	}

	const fromFreeText = await geocodeFreeTextToFormatted(trimmed, userAgent);
	if (fromFreeText) return fromFreeText;

	return "";
}

export {
	CA_POSTAL_PATTERN,
	CITY_REGION_CODE_PATTERN,
	US_ZIP_PATTERN,
	isCanadianPostalCode,
	isUsZipCode,
	nominatimCountryLabel,
	resolveOfferGeocodeCountry,
};
