/** Display separator for optional end time, e.g. "8/13/2026 8:00 AM — 12:00 PM" */
export const OFFER_DATETIME_RANGE_SEP = " — ";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

function monthIndexFromName(name: string): number {
	const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === name.toLowerCase());
	return idx;
}

function parse12hClock(hour: number, minute: number, period: string): { hour: number; minute: number } {
	let h = hour;
	const p = period.toLowerCase();
	if (p === "pm" && h < 12) h += 12;
	if (p === "am" && h === 12) h = 0;
	return { hour: h, minute };
}

function dateFromParts(year: number, monthIndex: number, day: number): Date | null {
	if (monthIndex < 0 || Number.isNaN(day) || Number.isNaN(year)) return null;
	const d = new Date(year, monthIndex, day, 0, 0, 0, 0);
	if (d.getFullYear() !== year || d.getMonth() !== monthIndex || d.getDate() !== day) {
		return null;
	}
	return d;
}

/** Date-only: "8/13/2026" or legacy "13 August 2026" — midnight local. */
export function parseOfferDateOnly(s: string): Date | null {
	const trimmed = s.trim();
	const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slash) {
		return dateFromParts(
			parseInt(slash[3], 10),
			parseInt(slash[1], 10) - 1,
			parseInt(slash[2], 10),
		);
	}
	const m = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
	if (!m) return null;
	return dateFromParts(
		parseInt(m[3], 10),
		monthIndexFromName(m[2]),
		parseInt(m[1], 10),
	);
}

/** "4 June 2026 8 AM" or "4 June 2026 8:30 AM" */
export function parseLongOfferDateTime(s: string): Date | null {
	const trimmed = s.trim();
	const m = trimmed.match(
		/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
	);
	if (!m) return null;
	const day = parseInt(m[1], 10);
	const month = monthIndexFromName(m[2]);
	const year = parseInt(m[3], 10);
	const hour = parseInt(m[4], 10);
	const minute = parseInt(m[5] ?? "0", 10) || 0;
	if (month < 0 || Number.isNaN(day) || Number.isNaN(year) || Number.isNaN(hour)) {
		return null;
	}
	const { hour: h, minute: min } = parse12hClock(hour, minute, m[6]);
	const d = new Date(year, month, day, h, min, 0, 0);
	if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
		return null;
	}
	return d;
}

/** Numeric US date without leading zeros: "8/13/2026" */
function formatUsMdY(d: Date): string {
	return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Client format without time: "8/13/2026" */
export function formatOfferDateOnly(d: Date): string {
	return formatUsMdY(d);
}

/** True when value is a date without a time component (e.g. URL `pu_at=8/13/2026`). */
export function isOfferDateWithoutTime(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (parseOfferDateTimeField(trimmed).start) return false;
	return parseOfferDateOnly(trimmed) != null;
}

export const OFFER_TIME_REQUIRED_ERROR = "Each stop must include a time";

/** Legacy: "03/24/2026 02:30 pm" */
export function parseSlashOfferDateTime(s: string): Date | null {
	const trimmed = s.trim();
	const re =
		/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/i;
	const m = trimmed.match(re);
	if (!m) return null;
	const month = parseInt(m[1], 10) - 1;
	const day = parseInt(m[2], 10);
	const year = parseInt(m[3], 10);
	const hour = parseInt(m[4], 10);
	const minute = parseInt(m[5], 10);
	const { hour: h, minute: min } = parse12hClock(hour, minute, m[6]);
	const d = new Date(year, month, day, h, min, 0, 0);
	if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
		return null;
	}
	return d;
}

/** "12 PM" or "8:30 AM" */
export function parseOfferTimeOnly(s: string, baseDate: Date): Date | null {
	const trimmed = s.trim();
	const m = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
	if (!m) return null;
	const hour = parseInt(m[1], 10);
	const minute = parseInt(m[2] ?? "0", 10) || 0;
	const { hour: h, minute: min } = parse12hClock(hour, minute, m[3]);
	const d = new Date(baseDate);
	d.setHours(h, min, 0, 0);
	return d;
}

export function parseSingleOfferDateTime(s: string): Date | null {
	return parseLongOfferDateTime(s) ?? parseSlashOfferDateTime(s);
}

export function parseOfferDateTimeField(value: string): {
	start: Date | null;
	end: Date | null;
} {
	const trimmed = value.trim();
	if (!trimmed) return { start: null, end: null };

	const rangeParts = splitOfferDateTimeRange(trimmed);
	if (rangeParts) {
		const [startPart, endPart] = rangeParts;
		const start = parseSingleOfferDateTime(startPart);
		if (!start || !endPart) return { start, end: null };
		const end =
			parseSingleOfferDateTime(endPart) ?? parseOfferTimeOnly(endPart, start);
		return { start, end };
	}

	return { start: parseSingleOfferDateTime(trimmed), end: null };
}

/**
 * Splits "start — end" / "start - end" ranges.
 * UI uses em dash; URL deep links often use a plain hyphen.
 */
function splitOfferDateTimeRange(trimmed: string): [string, string] | null {
	for (const sep of [OFFER_DATETIME_RANGE_SEP, " – ", " - "]) {
		if (!trimmed.includes(sep)) continue;
		const [startPart, endPart] = trimmed.split(sep).map(p => p.trim());
		if (startPart && endPart) return [startPart, endPart];
	}
	return null;
}

export type OfferMeridiem = "AM" | "PM";

/** Current time rounded up to the next 10-minute mark. Exact marks stay put. */
export function roundUpToTenMinutes(date: Date): Date {
	const next = new Date(date.getTime());
	next.setSeconds(0, 0);
	const remainder = next.getMinutes() % 10;
	if (remainder !== 0) {
		next.setMinutes(next.getMinutes() + (10 - remainder));
	}
	return next;
}

/**
 * Two-digit 24-hour entry → 12-hour display + AM/PM.
 * 00 → 12 AM, 14 → 02 PM, 16 → 04 PM, 12 → 12 PM.
 */
export function hour24DigitsTo12(
	digits: string
): { hour12: string; period: OfferMeridiem } | null {
	if (!/^\d{2}$/.test(digits)) return null;
	const hour = Number.parseInt(digits, 10);
	if (hour > 23) return null;
	if (hour === 0) return { hour12: "12", period: "AM" };
	if (hour < 12) return { hour12: String(hour).padStart(2, "0"), period: "AM" };
	if (hour === 12) return { hour12: "12", period: "PM" };
	return { hour12: String(hour - 12).padStart(2, "0"), period: "PM" };
}

export function defaultPickupDateTime(now: Date = new Date()): string {
	return formatOfferDateTime(roundUpToTenMinutes(now));
}

function formatTimePart(d: Date): string {
	let hours = d.getHours();
	const period = hours >= 12 ? "PM" : "AM";
	hours = hours % 12 || 12;
	const minutes = d.getMinutes();
	return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Client format: "8/13/2026 8:00 AM" */
export function formatOfferDateTime(d: Date): string {
	return `${formatUsMdY(d)} ${formatTimePart(d)}`;
}

/** Same day: "8/13/2026 8:00 AM — 12:00 PM"; different days: full end date */
export function formatOfferDateTimeRange(start: Date, end?: Date | null): string {
	if (!end) return formatOfferDateTime(start);
	const sameDay = start.toDateString() === end.toDateString();
	if (sameDay) {
		return `${formatOfferDateTime(start)}${OFFER_DATETIME_RANGE_SEP}${formatTimePart(end)}`;
	}
	return `${formatOfferDateTime(start)}${OFFER_DATETIME_RANGE_SEP}${formatOfferDateTime(end)}`;
}

/** Reformat a stored route time for UI (legacy month names → M/D/YYYY). */
export function formatOfferDateTimeFieldForDisplay(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (isOfferAsapTime(trimmed)) return trimmed;
	const { start, end } = parseOfferDateTimeField(trimmed);
	if (start) return formatOfferDateTimeRange(start, end);
	const dateOnly = parseOfferDateOnly(trimmed);
	if (dateOnly) return formatOfferDateOnly(dateOnly);
	return trimmed;
}

/** For flatpickr initial date sync (full datetime or date-only). */
export function parseOfferRouteDateTime(s: string): Date | null {
	return parseOfferDateTimeField(s).start ?? parseOfferDateOnly(s);
}

export const ROUTE_CHRONOLOGY_ERROR =
	"Each stop date & time must be on or after the previous stop";

export const END_TIME_AFTER_START_ERROR = "End time must be after start time";

/** Standard delivery-time placeholder when driver should deliver as soon as possible. */
export const OFFER_ASAP_TIME = "As soon as possible, negotiable";

export function isOfferAsapTime(value: string): boolean {
	const normalized = value.trim().toUpperCase();
	return (
		normalized === OFFER_ASAP_TIME.toUpperCase() || normalized === "ASAP"
	);
}

/** Ensures route stops are in non-decreasing chronological order by start time. */
export function isRouteChronologicallyValid(times: string[]): boolean {
	return getRouteChronologyError(times) === null;
}

/**
 * Validates per-stop time ranges and adjacent stop chronology.
 * Only compares consecutive stops when both have a filled date & time.
 */
export function getRouteChronologyError(times: string[]): string | null {
	const trimmed = times.map(time => time.trim());

	for (const time of trimmed) {
		if (!time || isOfferAsapTime(time)) continue;
		const { start, end } = parseOfferDateTimeField(time);
		if (start && end && end.getTime() <= start.getTime()) {
			return END_TIME_AFTER_START_ERROR;
		}
	}

	for (let i = 1; i < trimmed.length; i++) {
		const prevTime = trimmed[i - 1];
		const currTime = trimmed[i];
		if (!prevTime || !currTime) continue;
		if (isOfferAsapTime(prevTime) || isOfferAsapTime(currTime)) continue;
		const { start: prevStart } = parseOfferDateTimeField(prevTime);
		const { start: currStart } = parseOfferDateTimeField(currTime);
		if (prevStart && currStart && currStart.getTime() < prevStart.getTime()) {
			return ROUTE_CHRONOLOGY_ERROR;
		}
	}

	return null;
}

/**
 * Earliest datetime a stop may use: the previous filled stop's start.
 * Used to disable delivery dates before pick up.
 */
export function getRouteStopMinDate(times: string[], index: number): Date | null {
	for (let i = index - 1; i >= 0; i--) {
		const time = times[i]?.trim() ?? "";
		if (!time || isOfferAsapTime(time)) continue;
		const start = parseOfferRouteDateTime(time);
		if (start) return start;
	}
	return null;
}
