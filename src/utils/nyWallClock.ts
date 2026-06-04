const NY_TZ = "America/New_York";
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** Same format as Nest `formatNyWallClockSqlString` (YYYY-MM-DD HH:mm:ss, NY wall). */
export function formatNyWallClockSqlString(instant: Date): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: NY_TZ,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).formatToParts(instant);
	const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/** Parse DB `lastLocationUpdateAt` (NY wall or ISO). */
export function parseNaiveNyDateTime(value: string | null | undefined): Date | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
	if (!match) {
		const parsedFallback = new Date(trimmed.replace(" ", "T"));
		return Number.isFinite(parsedFallback.getTime()) ? parsedFallback : null;
	}
	const [, year, month, day, hour, minute, second] = match;
	const parsed = new Date(
		Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second)
		)
	);
	return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function normalizeNyWallClockForCompare(value: string): string | null {
	const trimmed = value.trim();
	const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
	if (!match) return null;
	const [, year, month, day, hour, minute, second] = match;
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export type LastLocationStaleOptions = {
	hours?: number;
	minutes?: number;
};

function staleThresholdMs(options?: LastLocationStaleOptions): number {
	const hours = Math.max(0, options?.hours ?? 0);
	const minutes = Math.max(0, options?.minutes ?? 0);
	return hours * MS_PER_HOUR + minutes * MS_PER_MINUTE;
}

/** True when last update is older than threshold vs current New York time. */
export function isLastLocationOlderThanNy(
	lastLocationUpdateAt: string | null | undefined,
	options?: LastLocationStaleOptions
): boolean {
	const raw = String(lastLocationUpdateAt ?? "").trim();
	if (!raw) return false;

	const thresholdMs = staleThresholdMs(options);
	if (thresholdMs <= 0) return false;

	const cutoffNy = formatNyWallClockSqlString(new Date(Date.now() - thresholdMs));
	const normalized = normalizeNyWallClockForCompare(raw);
	if (normalized) {
		return normalized < cutoffNy;
	}

	const parsed = parseNaiveNyDateTime(raw);
	if (!parsed) return false;
	return Date.now() - parsed.getTime() > thresholdMs;
}

/** True when last update is older than `hours` vs current New York time (default 3, check-list). */
export function isLastLocationOlderThanHoursNy(
	lastLocationUpdateAt: string | null | undefined,
	hours = 3
): boolean {
	return isLastLocationOlderThanNy(lastLocationUpdateAt, { hours });
}

/** @deprecated Use `isLastLocationOlderThanNy` — kept for call sites using 3h default. */
export function isLastLocationOlderThanThreeHoursNy(
	lastLocationUpdateAt: string | null | undefined
): boolean {
	return isLastLocationOlderThanNy(lastLocationUpdateAt, { hours: 3 });
}
