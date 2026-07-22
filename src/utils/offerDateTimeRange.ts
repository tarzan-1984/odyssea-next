/** Display separator for optional end time, e.g. "4 June 2026 8 AM — 12 PM" */
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

function formatTimePart(d: Date): string {
	let hours = d.getHours();
	const period = hours >= 12 ? "PM" : "AM";
	hours = hours % 12 || 12;
	const minutes = d.getMinutes();
	return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** Client format: "4 June 2026 8:00 AM" */
export function formatOfferDateTime(d: Date): string {
	const day = d.getDate();
	const month = MONTH_NAMES[d.getMonth()];
	const year = d.getFullYear();
	return `${day} ${month} ${year} ${formatTimePart(d)}`;
}

/** Same day: "4 June 2026 8:00 AM — 12:00 PM"; different days: full end date */
export function formatOfferDateTimeRange(start: Date, end?: Date | null): string {
	if (!end) return formatOfferDateTime(start);
	const sameDay = start.toDateString() === end.toDateString();
	if (sameDay) {
		return `${formatOfferDateTime(start)}${OFFER_DATETIME_RANGE_SEP}${formatTimePart(end)}`;
	}
	return `${formatOfferDateTime(start)}${OFFER_DATETIME_RANGE_SEP}${formatOfferDateTime(end)}`;
}

/** For flatpickr initial date sync */
export function parseOfferRouteDateTime(s: string): Date | null {
	return parseOfferDateTimeField(s).start;
}

export const ROUTE_CHRONOLOGY_ERROR =
	"Each stop date & time must be on or after the previous stop";

export const END_TIME_AFTER_START_ERROR = "End time must be after start time";

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
		if (!time) continue;
		const { start, end } = parseOfferDateTimeField(time);
		if (start && end && end.getTime() <= start.getTime()) {
			return END_TIME_AFTER_START_ERROR;
		}
	}

	for (let i = 1; i < trimmed.length; i++) {
		const prevTime = trimmed[i - 1];
		const currTime = trimmed[i];
		if (!prevTime || !currTime) continue;
		const { start: prevStart } = parseOfferDateTimeField(prevTime);
		const { start: currStart } = parseOfferDateTimeField(currTime);
		if (prevStart && currStart && currStart.getTime() < prevStart.getTime()) {
			return ROUTE_CHRONOLOGY_ERROR;
		}
	}

	return null;
}
