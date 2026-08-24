import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import { formatOfferDateTime, formatOfferDateTimeRange } from "@/utils/offerDateTimeRange";

type TmsLoadLocationPoint = {
	short_address?: string | null;
	address?: string | null;
	date?: string | null;
	time_start?: string | null;
	time_end?: string | null;
	order?: number | null;
	sort_order?: number | null;
	type?: string | null;
	address_id?: string | number | null;
};

export type TmsLoadRoutePoint = {
	type: "pick_up_location" | "delivery_location";
	label: string;
	location: string;
	time: string;
};

export type OrderedTmsLoadStop = {
	type: TmsLoadRoutePoint["type"];
	loc: TmsLoadLocationPoint;
};

function formatOrdinal(n: number): string {
	const rem100 = n % 100;
	if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
	const rem10 = n % 10;
	if (rem10 === 1) return `${n}st`;
	if (rem10 === 2) return `${n}nd`;
	if (rem10 === 3) return `${n}rd`;
	return `${n}th`;
}

function formatStopLabel(
	type: TmsLoadRoutePoint["type"],
	index: number,
	total: number
): string {
	const kind = type === "pick_up_location" ? "Pick up" : "Delivery";
	if (total <= 1) return kind;
	return `${formatOrdinal(index)} ${kind}`;
}

function parseLocationPoints(raw: unknown): TmsLoadLocationPoint[] {
	if (!raw) return [];

	let parsed: unknown = raw;
	if (typeof raw === "string") {
		const trimmed = raw.trim();
		if (!trimmed) return [];
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			return [{ address: trimmed }];
		}
	}

	const arr = Array.isArray(parsed) ? parsed : [parsed];
	return arr.filter((item): item is TmsLoadLocationPoint =>
		Boolean(item && typeof item === "object")
	);
}

function normalizeStopType(
	type: unknown,
	fallback: TmsLoadRoutePoint["type"]
): TmsLoadRoutePoint["type"] {
	const normalized = String(type ?? "")
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
	if (normalized === "pick_up_location" || normalized === "pickup") {
		return "pick_up_location";
	}
	if (normalized === "delivery_location" || normalized === "delivery") {
		return "delivery_location";
	}
	return fallback;
}

/** Appointment start from TMS `date` + `time_start` (time_start overrides the clock on date). */
function appointmentStartMs(loc: TmsLoadLocationPoint): number | null {
	const baseDate = parseTmsLocationDate(loc.date);
	const startTime = loc.time_start?.trim();
	if (baseDate && startTime) {
		const withStart = applyClockTime(baseDate, startTime);
		if (withStart) return withStart.getTime();
	}
	if (baseDate) return baseDate.getTime();
	return null;
}

function compareOrderedStops(
	a: OrderedTmsLoadStop & { index: number },
	b: OrderedTmsLoadStop & { index: number }
): number {
	const startA = appointmentStartMs(a.loc);
	const startB = appointmentStartMs(b.loc);
	if (startA != null && startB != null && startA !== startB) return startA - startB;
	if (startA != null && startB == null) return -1;
	if (startA == null && startB != null) return 1;

	if (a.type !== b.type) {
		return a.type === "pick_up_location" ? -1 : 1;
	}

	const orderA = a.loc.order ?? a.loc.sort_order;
	const orderB = b.loc.order ?? b.loc.sort_order;
	if (
		typeof orderA === "number" &&
		Number.isFinite(orderA) &&
		typeof orderB === "number" &&
		Number.isFinite(orderB) &&
		orderA !== orderB
	) {
		return orderA - orderB;
	}

	return a.index - b.index;
}

/**
 * Merge pickup + delivery stops and sort by appointment start (`date` + `time_start`)
 * so mixed PU/DEL itineraries stay sequential instead of grouped by type.
 */
export function collectOrderedTmsLoadStops(
	pickUpRaw: unknown,
	deliveryRaw: unknown
): OrderedTmsLoadStop[] {
	const pickups = parseLocationPoints(pickUpRaw).map((loc, index) => ({
		type: normalizeStopType(loc.type, "pick_up_location"),
		loc,
		index,
	}));
	const deliveries = parseLocationPoints(deliveryRaw).map((loc, index) => ({
		type: normalizeStopType(loc.type, "delivery_location"),
		loc,
		index: pickups.length + index,
	}));

	return [...pickups, ...deliveries]
		.sort(compareOrderedStops)
		.map(({ type, loc }) => ({ type, loc }));
}

function locationLabel(loc: TmsLoadLocationPoint): string {
	const address = loc.address?.trim();
	if (address) {
		const parts = address.split(",").map(part => part.trim());
		if (parts.length >= 2) {
			return abbreviateStateInLocationString(parts.slice(-2).join(", "));
		}
		return abbreviateStateInLocationString(address);
	}

	const shortAddress = loc.short_address?.trim();
	if (shortAddress) {
		return abbreviateStateInLocationString(shortAddress);
	}

	return "";
}

function parseTmsLocationDate(dateStr: string | null | undefined): Date | null {
	const trimmed = dateStr?.trim();
	if (!trimmed) return null;

	const match = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
	);
	if (!match) return null;

	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10) - 1;
	const day = parseInt(match[3], 10);
	const hour = match[4] != null ? parseInt(match[4], 10) : 0;
	const minute = match[5] != null ? parseInt(match[5], 10) : 0;
	const date = new Date(year, month, day, hour, minute, 0, 0);
	if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
		return null;
	}
	return date;
}

function applyClockTime(baseDate: Date, timeStr: string): Date | null {
	const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
	if (!match) return null;

	const next = new Date(baseDate);
	next.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
	return next;
}

function formatTmsStopDateTime(loc: TmsLoadLocationPoint): string {
	const baseDate = parseTmsLocationDate(loc.date);
	if (!baseDate) return "";

	const startTime = loc.time_start?.trim();
	const endTime = loc.time_end?.trim();
	let start = baseDate;

	if (startTime) {
		const withStart = applyClockTime(baseDate, startTime);
		if (withStart) start = withStart;
	}

	if (endTime) {
		const end = applyClockTime(start, endTime);
		if (end && end.getTime() > start.getTime()) {
			return formatOfferDateTimeRange(start, end);
		}
	}

	return formatOfferDateTime(start);
}

function toRoutePoint(
	loc: TmsLoadLocationPoint,
	type: TmsLoadRoutePoint["type"],
	label: string
): TmsLoadRoutePoint | null {
	const location = locationLabel(loc);
	if (!location) return null;

	return {
		type,
		label,
		location,
		time: formatTmsStopDateTime(loc),
	};
}

/** Ordered pickup + delivery points for load tracking route display. */
export function buildTmsLoadRoutePoints(
	pickUpRaw: unknown,
	deliveryRaw: unknown
): TmsLoadRoutePoint[] {
	const ordered = collectOrderedTmsLoadStops(pickUpRaw, deliveryRaw);
	const pickupTotal = ordered.filter(stop => stop.type === "pick_up_location").length;
	const deliveryTotal = ordered.filter(stop => stop.type === "delivery_location").length;
	let pickupIndex = 0;
	let deliveryIndex = 0;
	const points: TmsLoadRoutePoint[] = [];

	for (const stop of ordered) {
		if (stop.type === "pick_up_location") {
			pickupIndex += 1;
			const point = toRoutePoint(
				stop.loc,
				stop.type,
				formatStopLabel(stop.type, pickupIndex, pickupTotal)
			);
			if (point) points.push(point);
		} else {
			deliveryIndex += 1;
			const point = toRoutePoint(
				stop.loc,
				stop.type,
				formatStopLabel(stop.type, deliveryIndex, deliveryTotal)
			);
			if (point) points.push(point);
		}
	}

	return points;
}

function formatRoutePointBlock(point: TmsLoadRoutePoint): string {
	const lines = [`${point.label}:`, point.location];
	if (point.time) {
		lines.push(`Date & time: ${point.time}`);
	}
	return lines.join("\n");
}

/** Multiline route blocks: label, address, then date & time per stop. */
export function formatTmsLoadRoute(pickUpRaw: unknown, deliveryRaw: unknown): string {
	return buildTmsLoadRoutePoints(pickUpRaw, deliveryRaw)
		.map(formatRoutePointBlock)
		.join("\n\n");
}
