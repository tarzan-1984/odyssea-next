export type HeaderTimeZoneDef = {
	label: string;
	timeZone: string;
};

/** Canonical order for header clocks (left → right). */
export const HEADER_TIME_ZONES: HeaderTimeZoneDef[] = [
	{ label: "Alaska Time", timeZone: "America/Anchorage" },
	{ label: "Pacific Time (Los Angeles)", timeZone: "America/Los_Angeles" },
	{ label: "Mountain Time (Denver)", timeZone: "America/Denver" },
	{ label: "Central Time (Dallas)", timeZone: "America/Chicago" },
	{ label: "New York (ET)", timeZone: "America/New_York" },
	{ label: "Algeria", timeZone: "Africa/Algiers" },
	{ label: "Poland", timeZone: "Europe/Warsaw" },
	{ label: "Ukraine", timeZone: "Europe/Kyiv" },
	{ label: "Georgia", timeZone: "Asia/Tbilisi" },
	{ label: "Uzbekistan", timeZone: "Asia/Tashkent" },
];

export const DEFAULT_VISIBLE_HEADER_TIME_ZONES: string[] = [
	"America/New_York",
	"Europe/Warsaw",
];

const ALLOWED_TIME_ZONES = new Set(HEADER_TIME_ZONES.map(z => z.timeZone));

/** Keeps only known zones, preserves HEADER_TIME_ZONES order; falls back to defaults if empty. */
export function normalizeVisibleHeaderTimeZones(zones: unknown): string[] {
	const input = Array.isArray(zones) ? zones : [];
	const picked = new Set(
		input.filter((z): z is string => typeof z === "string" && ALLOWED_TIME_ZONES.has(z))
	);
	const ordered = HEADER_TIME_ZONES.filter(z => picked.has(z.timeZone)).map(z => z.timeZone);
	if (ordered.length > 0) {
		return ordered;
	}
	return [...DEFAULT_VISIBLE_HEADER_TIME_ZONES];
}
