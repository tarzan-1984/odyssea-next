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
};

export type TmsLoadRoutePoint = {
	type: "pick_up_location" | "delivery_location";
	label: string;
	location: string;
	time: string;
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

function stopSortKey(loc: TmsLoadLocationPoint, index: number): number {
	const order = loc.order ?? loc.sort_order;
	if (typeof order === "number" && Number.isFinite(order)) return order;
	return index;
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
	const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
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
	const pickups = parseLocationPoints(pickUpRaw)
		.map((loc, index) => ({ loc, index }))
		.sort((a, b) => stopSortKey(a.loc, a.index) - stopSortKey(b.loc, b.index));
	const deliveries = parseLocationPoints(deliveryRaw)
		.map((loc, index) => ({ loc, index }))
		.sort((a, b) => stopSortKey(a.loc, a.index) - stopSortKey(b.loc, b.index));

	const pickupPoints: TmsLoadRoutePoint[] = [];
	for (let index = 0; index < pickups.length; index++) {
		const point = toRoutePoint(
			pickups[index].loc,
			"pick_up_location",
			formatStopLabel("pick_up_location", index + 1, pickups.length)
		);
		if (point) pickupPoints.push(point);
	}

	const deliveryPoints: TmsLoadRoutePoint[] = [];
	for (let index = 0; index < deliveries.length; index++) {
		const point = toRoutePoint(
			deliveries[index].loc,
			"delivery_location",
			formatStopLabel("delivery_location", index + 1, deliveries.length)
		);
		if (point) deliveryPoints.push(point);
	}

	return [...pickupPoints, ...deliveryPoints];
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
