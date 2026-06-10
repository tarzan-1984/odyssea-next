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

const NY_WALL_CLOCK_RE =
	/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z)?$/;

function parseNyWallClockParts(value: string): Date | null {
	const match = value.match(NY_WALL_CLOCK_RE);
	if (!match) return null;
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

/** Parse DB/API timestamps stored as NY wall-clock (naive or ISO with Z). */
export function parseNaiveNyDateTime(value: string | null | undefined): Date | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const parsed = parseNyWallClockParts(trimmed);
	if (parsed) return parsed;
	const parsedFallback = new Date(trimmed.replace(" ", "T"));
	return Number.isFinite(parsedFallback.getTime()) ? parsedFallback : null;
}

/** Format chat message time in New York wall-clock (HH:MM AM/PM). */
export function formatNyWallClockTime(value: string | null | undefined): string {
	const date = parseNaiveNyDateTime(value);
	if (!date) return "";
	return date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "UTC",
	});
}

/**
 * Format NY-naive timestamps for tracking UI (driver_tracking ISO-Z, lastLocationUpdateAt).
 * Stored UTC components match America/New_York wall-clock digits — always render with timeZone UTC.
 */
export function formatNyWallClockForDisplay(
	value: string | null | undefined
): string {
	if (!value?.trim()) return "N/A";
	const date = parseNaiveNyDateTime(value);
	if (!date) return value;
	return new Intl.DateTimeFormat(undefined, {
		timeZone: "UTC",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	}).format(date);
}

/** Format chat message date and time in New York wall-clock (e.g. Jun 10, 2026, 11:27 AM). */
export function formatNyWallClockDateTime(value: string | null | undefined): string {
	const date = parseNaiveNyDateTime(value);
	if (!date) return "";
	const datePart = date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "UTC",
	});
	return `${datePart}, ${timePart}`;
}

function nowNyWallClockDate(): Date {
	return parseNaiveNyDateTime(formatNyWallClockSqlString(new Date()))!;
}

/** Relative label for chat list (Just now / Nm / Nh / Nd) vs current NY time. */
export function formatChatRelativeTimeNy(value: string | null | undefined): string {
	const messageTime = parseNaiveNyDateTime(value);
	if (!messageTime) return "";
	const now = nowNyWallClockDate();
	const diffInMinutes = Math.floor(
		(now.getTime() - messageTime.getTime()) / MS_PER_MINUTE
	);
	if (diffInMinutes < 1) return "Just now";
	if (diffInMinutes < 60) return `${diffInMinutes}m`;
	if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
	return `${Math.floor(diffInMinutes / 1440)}d`;
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
