import {
	isBarePostalInput,
	lettersOnlyKey,
	parseCityRegionFromAddress,
	parseCityRegionPostalLine,
	placeNamesMatch,
} from "./offerLocationCountry";
import {
	LOCATION_GEOCODE_ERROR,
	LOCATION_POSTAL_ERROR,
	LOCATION_ZIP_MISMATCH_ERROR,
	locationHasPostalCode,
} from "./offerLocationFormat";

export type GoogleRouteWaypointLike = {
	resolvedAddress: string;
	latitude: number;
	longitude: number;
	zipCode: string | null;
};

export type OfferRouteStop = {
	location: string;
	latitude: number | null;
	longitude: number | null;
	zipCode: string | null;
	error: string | null;
};

export type OfferRouteDistanceResult = {
	loadedMiles: number;
	stops: OfferRouteStop[];
};

type ParsedPlace = {
	city: string;
	regionCode: string;
	postal: string | null;
};

function compactPostal(postal: string): string {
	return postal.replace(/\s/g, "").replace(/-\d{4}$/, "").toUpperCase();
}

function postalsCompatible(userPostal: string, googlePostal: string): boolean {
	const user = compactPostal(userPostal);
	const google = compactPostal(googlePostal);
	if (!user || !google) return false;
	if (user === google) return true;
	// Canadian FSA (N7M) vs full code (N7M 1A1)
	return user.length === 3 && /^[A-Z]\d[A-Z]$/.test(user) && google.startsWith(user);
}

function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (!a) return b.length;
	if (!b) return a.length;
	const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = prev[0];
		prev[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const nextDiagonal = prev[j];
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + cost);
			diagonal = nextDiagonal;
		}
	}
	return prev[b.length];
}

/** True when the typed city looks like a misspelling of the geocoded city (Waseon → Wauseon). */
function isLikelyCityTypo(userCity: string, googleCity: string): boolean {
	if (!userCity.trim() || !googleCity.trim()) return false;
	if (placeNamesMatch(userCity, googleCity)) return false;
	const left = lettersOnlyKey(userCity);
	const right = lettersOnlyKey(googleCity);
	if (!left || !right) return false;
	const distance = levenshtein(left, right);
	const maxLen = Math.max(left.length, right.length);
	if (maxLen <= 4) return distance === 1;
	return distance > 0 && distance <= 2;
}

function stripTrailingCountry(address: string): string {
	return address
		.trim()
		.replace(/\s+/g, " ")
		.replace(
			/,?\s*(United States of America|United States|USA|U\.S\.A\.?|U\.S\.|US|Canada|Mexico|México)\.?$/i,
			"",
		)
		.trim();
}

function formatCityStatePostal(city: string, regionCode: string, postal: string): string {
	return `${city.trim()}, ${regionCode.trim()} ${postal.trim()}`.replace(/\s+/g, " ").trim();
}

function parseUserPlace(input: string): ParsedPlace | null {
	const line = parseCityRegionPostalLine(input);
	if (line) {
		return { city: line.city, regionCode: line.regionCode, postal: line.postal };
	}
	const cityRegion = parseCityRegionFromAddress(input);
	if (cityRegion) {
		return { city: cityRegion.city, regionCode: cityRegion.regionCode, postal: null };
	}
	if (isBarePostalInput(input)) {
		return { city: "", regionCode: "", postal: input.trim() };
	}
	return null;
}

/** Parse Google's street or city line into city / region / postal. Never keep the street. */
export function parseGoogleResolvedPlace(
	resolvedAddress: string,
	zipCode?: string | null,
): ParsedPlace | null {
	const stripped = stripTrailingCountry(resolvedAddress);
	if (!stripped) return null;

	const parts = stripped
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length >= 2) {
		const tail = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
		const parsed = parseCityRegionPostalLine(tail);
		if (parsed) {
			return { city: parsed.city, regionCode: parsed.regionCode, postal: parsed.postal };
		}
		const cityState = parseCityRegionFromAddress(tail);
		if (cityState) {
			return {
				city: cityState.city,
				regionCode: cityState.regionCode,
				postal: zipCode?.trim() || null,
			};
		}
	}

	const postalLine = parseCityRegionPostalLine(stripped);
	if (postalLine) {
		return { city: postalLine.city, regionCode: postalLine.regionCode, postal: postalLine.postal };
	}
	const cityStateLine = parseCityRegionFromAddress(stripped);
	if (cityStateLine) {
		return {
			city: cityStateLine.city,
			regionCode: cityStateLine.regionCode,
			postal: zipCode?.trim() || null,
		};
	}

	if (zipCode?.trim() && parts.length > 0) {
		const cityState = parseCityRegionFromAddress(`${parts[0]}, ${parts[1] ?? ""}`.replace(/,\s*$/, ""));
		if (cityState) {
			return { city: cityState.city, regionCode: cityState.regionCode, postal: zipCode.trim() };
		}
	}

	return null;
}

export function resolveStopFromGoogleWaypoint(
	userInput: string,
	waypoint: GoogleRouteWaypointLike | null | undefined,
): OfferRouteStop {
	const failed = (error: string): OfferRouteStop => ({
		location: userInput.trim(),
		latitude: null,
		longitude: null,
		zipCode: null,
		error,
	});

	if (
		!waypoint ||
		!Number.isFinite(waypoint.latitude) ||
		!Number.isFinite(waypoint.longitude)
	) {
		return failed(LOCATION_GEOCODE_ERROR);
	}

	const user = parseUserPlace(userInput);
	const google = parseGoogleResolvedPlace(waypoint.resolvedAddress, waypoint.zipCode);
	const googlePostal = google?.postal ?? waypoint.zipCode?.trim() ?? null;

	if (user?.regionCode && google?.regionCode && user.regionCode !== google.regionCode) {
		return failed(LOCATION_ZIP_MISMATCH_ERROR);
	}
	if (user?.postal && googlePostal && !postalsCompatible(user.postal, googlePostal)) {
		return failed(LOCATION_ZIP_MISMATCH_ERROR);
	}

	// Near-miss city spelling (Forth → Fort, Waseon → Wauseon): keep Google's name.
	const cityTypo =
		user?.city != null &&
		google?.city != null &&
		isLikelyCityTypo(user.city, google.city);
	const city = (cityTypo ? google.city : user?.city || google?.city || "").trim();
	const regionCode = (user?.regionCode || google?.regionCode || "").trim();
	const postal = (googlePostal || user?.postal || "").trim();

	if (!city || !regionCode) {
		return failed(LOCATION_GEOCODE_ERROR);
	}

	// Google often omits ZIP on "City, ST". Keep coords and fill postal afterwards.
	if (!postal) {
		return {
			location: `${city}, ${regionCode}`,
			latitude: waypoint.latitude,
			longitude: waypoint.longitude,
			zipCode: null,
			error: null,
		};
	}

	return {
		location: formatCityStatePostal(city, regionCode, postal),
		latitude: waypoint.latitude,
		longitude: waypoint.longitude,
		zipCode: postal,
		error: null,
	};
}

export function applyGoogleWaypointsToLocations(
	locations: string[],
	waypoints: GoogleRouteWaypointLike[],
): OfferRouteStop[] {
	return locations.map((location, index) =>
		resolveStopFromGoogleWaypoint(location, waypoints[index] ?? null),
	);
}

export type PostalReverseHit = {
	postal: string;
	city?: string | null;
	regionCode?: string | null;
};

/**
 * When Google Directions omitted ZIP on a city-level stop, reverse the coords
 * we already have (geo_zips / PostGIS) — no Zippopotam / Nominatim round-trip.
 */
export async function enrichStopsWithPostal(
	stops: OfferRouteStop[],
	reversePostal: (
		latitude: number,
		longitude: number,
	) => Promise<PostalReverseHit | null>,
): Promise<OfferRouteStop[]> {
	return await Promise.all(
		stops.map(async (stop) => {
			if (stop.error) return stop;
			if (stop.zipCode || locationHasPostalCode(stop.location)) return stop;
			if (
				stop.latitude == null ||
				stop.longitude == null ||
				!Number.isFinite(stop.latitude) ||
				!Number.isFinite(stop.longitude)
			) {
				return { ...stop, error: LOCATION_POSTAL_ERROR };
			}

			const hit = await reversePostal(stop.latitude, stop.longitude);
			const postal = hit?.postal?.trim() ?? "";
			if (!postal) {
				return { ...stop, error: LOCATION_POSTAL_ERROR };
			}

			const place = parseUserPlace(stop.location);
			const city = (place?.city || hit?.city || "").trim();
			const regionCode = (place?.regionCode || hit?.regionCode || "").trim();
			if (!city || !regionCode) {
				return { ...stop, error: LOCATION_POSTAL_ERROR };
			}

			return {
				location: formatCityStatePostal(city, regionCode, postal),
				latitude: stop.latitude,
				longitude: stop.longitude,
				zipCode: postal,
				error: null,
			};
		}),
	);
}

export function mergeChunkedWaypoints(
	collected: GoogleRouteWaypointLike[],
	chunk: GoogleRouteWaypointLike[],
	isFirstChunk: boolean,
): GoogleRouteWaypointLike[] {
	const incoming = isFirstChunk ? chunk : chunk.slice(1);
	return collected.concat(incoming);
}

export function offerRouteStopsResolved(stops: OfferRouteStop[]): boolean {
	return (
		stops.length > 0 &&
		stops.every(
			(stop) =>
				!stop.error &&
				stop.latitude != null &&
				stop.longitude != null &&
				Number.isFinite(stop.latitude) &&
				Number.isFinite(stop.longitude) &&
				Boolean(stop.zipCode || locationHasPostalCode(stop.location)),
		)
	);
}
