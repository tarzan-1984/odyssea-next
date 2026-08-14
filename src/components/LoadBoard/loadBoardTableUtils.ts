import type { LoadBoardShipment } from "@/app-api/loadBoardShipments";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import {
	formatNyWallClockSqlString,
	parseNaiveNyDateTime,
} from "@/utils/nyWallClock";
import { getEquipmentLabel, getShipmentStatusLabel } from "./newShipmentConstants";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const MS_PER_MONTH = 30 * MS_PER_DAY;

function formatAgeDiffMs(diffMs: number): string {
	if (diffMs >= MS_PER_MONTH) return "more than a month ago";
	if (diffMs >= MS_PER_WEEK) return "more than a week ago";

	if (diffMs >= MS_PER_DAY) {
		const days = Math.floor(diffMs / MS_PER_DAY);
		return days === 1 ? "1 day ago" : `${days} days ago`;
	}

	if (diffMs >= MS_PER_HOUR) {
		const hours = Math.floor(diffMs / MS_PER_HOUR);
		return `${hours}h ago`;
	}

	if (diffMs >= MS_PER_MINUTE) {
		const minutes = Math.floor(diffMs / MS_PER_MINUTE);
		return `${minutes}m ago`;
	}

	const seconds = Math.floor(diffMs / MS_PER_SECOND);
	return seconds <= 0 ? "just now" : `${seconds}s ago`;
}

/**
 * Current America/New_York wall-clock as a naive Date (UTC components = NY digits).
 * Same space as backend `nowInNewYorkAsNaiveDate()` / created_at in DB.
 */
export function getNyNaiveNow(now: Date = new Date()): Date {
	return parseNaiveNyDateTime(formatNyWallClockSqlString(now))!;
}

/**
 * Age = current NY wall-clock minus created_at (also stored as NY wall-clock).
 * - under 1 min: Ns ago / just now
 * - under 1 hour: Nm ago
 * - under 24 hours: Nh ago
 * - under 1 week: N day(s) ago
 * - under 1 month: more than a week ago
 * - otherwise: more than a month ago
 */
export function formatShipmentAge(
	createdAt: string | null | undefined,
	now: Date = new Date(),
): string {
	if (!createdAt) return "—";
	const created = parseNaiveNyDateTime(createdAt);
	if (!created) return "—";

	// Both sides are NY wall-clock naive dates — plain subtraction.
	const diffMs = Math.max(0, getNyNaiveNow(now).getTime() - created.getTime());
	return formatAgeDiffMs(diffMs);
}

/**
 * Age from an ISO instant (e.g. rate_load_board.bid_time).
 * Uses the provided `now` snapshot — do not tick this in a live interval.
 */
export function formatInstantAge(
	from: string | null | undefined,
	now: Date,
): string {
	if (!from) return "";
	const fromMs = Date.parse(from);
	if (!Number.isFinite(fromMs)) {
		const fallback = formatShipmentAge(from, now);
		return fallback === "—" ? "" : fallback;
	}
	return formatAgeDiffMs(Math.max(0, now.getTime() - fromMs));
}

export function formatPickupColumn(shipment: LoadBoardShipment): string {
	const date = shipment.pickupEarliest?.trim() || "";
	const hours = shipment.pickupHours?.trim() || "";
	if (!date) return "—";
	return hours ? `${date} ${hours}` : date;
}

/** Join date range parts: "from – to" when both present. */
function formatDateRange(
	earliest: string | null | undefined,
	latest: string | null | undefined,
): string {
	const from = earliest?.trim() || "";
	const to = latest?.trim() || "";
	if (from && to && from !== to) return `${from} – ${to}`;
	return from || to || "";
}

/**
 * Schedule line for first pickup / last delivery in Details → Route.
 * Example: "08/14/2026 12:00 pm – 08/15/2026"
 */
export function formatLoadBoardPickupSchedule(shipment: LoadBoardShipment): string {
	const dateRange = formatDateRange(shipment.pickupEarliest, shipment.pickupLatest);
	const hours = shipment.pickupHours?.trim() || "";
	if (!dateRange && !hours) return "";
	if (!dateRange) return hours;
	if (!hours) return dateRange;
	// Attach hours to the earliest date side: "08/14/2026 12:00 pm – 08/15/2026"
	const earliest = shipment.pickupEarliest?.trim() || "";
	const latest = shipment.pickupLatest?.trim() || "";
	if (earliest && latest && earliest !== latest) {
		return `${earliest} ${hours} – ${latest}`;
	}
	return `${dateRange} ${hours}`;
}

export function formatLoadBoardDeliverySchedule(shipment: LoadBoardShipment): string {
	const dateRange = formatDateRange(
		shipment.deliveryEarliest,
		shipment.deliveryLatest,
	);
	const hours = shipment.dropOffHours?.trim() || "";
	if (!dateRange && !hours) return "";
	if (!dateRange) return hours;
	if (!hours) return dateRange;
	return `${dateRange}, ${hours}`;
}

export type LoadBoardRouteDetailLine = {
	label: "Pick up" | "Delivery";
	location: string;
	/** From–to schedule for first pickup / last delivery only. */
	schedule: string;
};

/** Route lines for Details: schedule on first pick-up and last delivery. */
export function getLoadBoardRouteDetailLines(
	shipment: LoadBoardShipment,
): LoadBoardRouteDetailLine[] {
	const route = Array.isArray(shipment.route) ? shipment.route : [];
	if (route.length === 0) return [];

	const firstPickupIndex = route.findIndex(
		point => point.type === "pick_up_location",
	);
	let lastDeliveryIndex = -1;
	for (let i = route.length - 1; i >= 0; i--) {
		if (route[i]?.type === "delivery_location") {
			lastDeliveryIndex = i;
			break;
		}
	}

	const pickupSchedule = formatLoadBoardPickupSchedule(shipment);
	const deliverySchedule = formatLoadBoardDeliverySchedule(shipment);

	return route.map((point, index) => {
		const isPickup = point.type === "pick_up_location";
		const label: "Pick up" | "Delivery" = isPickup ? "Pick up" : "Delivery";
		const location = abbreviateStateInLocationString(point.location ?? "") || "—";
		let schedule = "";
		if (index === firstPickupIndex) {
			schedule = pickupSchedule;
		} else if (index === lastDeliveryIndex) {
			schedule = deliverySchedule;
		}
		return { label, location, schedule };
	});
}

/** City + state only (no ZIP) for Trip column. */
export function formatTripLocation(location: string | null | undefined): string {
	const abbreviated = abbreviateStateInLocationString(location);
	if (!abbreviated) return "—";
	return abbreviated.replace(/\s+\d{5}(?:-\d{4})?\s*$/, "").trim() || abbreviated;
}

export function getTripEndpoints(shipment: LoadBoardShipment): {
	origin: string;
	destination: string;
} {
	const route = Array.isArray(shipment.route) ? shipment.route : [];
	const origin =
		route.find(point => point.type === "pick_up_location")?.location ??
		route[0]?.location ??
		"";
	const destination =
		[...route].reverse().find(point => point.type === "delivery_location")
			?.location ??
		route[route.length - 1]?.location ??
		"";
	return {
		origin: formatTripLocation(origin),
		destination: formatTripLocation(destination),
	};
}

export function formatWeightLbs(weight: number | null | undefined): string {
	if (weight == null || !Number.isFinite(weight)) return "—";
	return `${Math.round(weight).toLocaleString("en-US")} lbs`;
}

export function formatRate(rate: number | null | undefined): string {
	if (rate == null || !Number.isFinite(rate)) return "—";
	return `$${Math.round(rate).toLocaleString("en-US")}`;
}

export function formatLoadedMiles(miles: number | null | undefined): string {
	if (miles == null || !Number.isFinite(miles)) return "—";
	return Math.round(miles).toLocaleString("en-US");
}

export function formatEquipment(equipment: string): string {
	return getEquipmentLabel(equipment);
}

export function formatStatus(status: string): string {
	return getShipmentStatusLabel(status);
}

export function formatSpecialInstructions(
	values: string[] | null | undefined,
): string {
	if (!values || values.length === 0) return "—";
	return values.join(", ");
}

type UsDateParts = { year: number; month: number; day: number };
type TimeParts = { hour: number; minute: number };

function parseLoadBoardUsDate(value: string): UsDateParts | null {
	const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (!match) return null;
	const month = Number(match[1]);
	const day = Number(match[2]);
	const year = Number(match[3]);
	const probe = new Date(Date.UTC(year, month - 1, day));
	if (
		probe.getUTCFullYear() !== year ||
		probe.getUTCMonth() !== month - 1 ||
		probe.getUTCDate() !== day
	) {
		return null;
	}
	return { year, month, day };
}

function parseLoadBoardPickupHours(value: string): TimeParts | null {
	const match = value
		.trim()
		.toLowerCase()
		.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
	if (!match) return null;
	let hour = Number(match[1]);
	const minute = Number(match[2]);
	const meridiem = match[3];
	if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
	if (meridiem === "am") {
		if (hour === 12) hour = 0;
	} else if (hour !== 12) {
		hour += 12;
	}
	return { hour, minute };
}

const HOURS_RANGE_SEPARATORS = [" — ", " – ", " - "] as const;

function parseLoadBoardHoursField(value: string): {
	start: TimeParts | null;
	end: TimeParts | null;
} {
	const trimmed = value.trim();
	if (!trimmed) return { start: null, end: null };

	for (const sep of HOURS_RANGE_SEPARATORS) {
		if (!trimmed.includes(sep)) continue;
		const [startPart, endPart] = trimmed.split(sep).map((p) => p.trim());
		if (!startPart || !endPart) continue;
		return {
			start: parseLoadBoardPickupHours(startPart),
			end: parseLoadBoardPickupHours(endPart),
		};
	}

	return { start: parseLoadBoardPickupHours(trimmed), end: null };
}

function resolveLoadBoardHoursDeadlineParts(value: string): TimeParts | null {
	const { start, end } = parseLoadBoardHoursField(value);
	if (!start) return null;
	if (end && (start.hour !== end.hour || start.minute !== end.minute)) {
		return end;
	}
	return start;
}

/** Pickup window end in naive NY wall-clock (same rules as Nest). */
export function resolveLoadBoardPickupDeadline(fields: {
	pickupEarliest?: string | null;
	pickupLatest?: string | null;
	pickupHours?: string | null;
}): Date | null {
	const dateRaw =
		fields.pickupLatest?.trim() || fields.pickupEarliest?.trim() || "";
	const date = parseLoadBoardUsDate(dateRaw);
	if (!date) return null;

	const hoursRaw = fields.pickupHours?.trim();
	if (hoursRaw) {
		const time = resolveLoadBoardHoursDeadlineParts(hoursRaw);
		if (!time) return null;
		return new Date(
			Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0),
		);
	}

	return new Date(Date.UTC(date.year, date.month - 1, date.day, 23, 59, 59));
}

export function isLoadBoardPickupExpired(
	fields: {
		pickupEarliest?: string | null;
		pickupLatest?: string | null;
		pickupHours?: string | null;
		pickupExpired?: boolean;
	},
	now: Date = new Date(),
): boolean {
	const deadline = resolveLoadBoardPickupDeadline(fields);
	if (deadline) {
		return deadline.getTime() < getNyNaiveNow(now).getTime();
	}
	if (typeof fields.pickupExpired === "boolean") {
		return fields.pickupExpired;
	}
	return false;
}

/** Client-side create/edit validation message, or null when OK. */
export function getLoadBoardPickupPastError(fields: {
	pickupEarliest?: string | null;
	pickupLatest?: string | null;
	pickupHours?: string | null;
	deliveryEarliest?: string | null;
	deliveryLatest?: string | null;
	dropOffHours?: string | null;
}): string | null {
	const earliestRaw = fields.pickupEarliest?.trim() || "";
	if (!earliestRaw) return "Pick up earliest is required.";
	const earliest = parseLoadBoardUsDate(earliestRaw);
	if (!earliest) return "Pick up earliest must be a valid date (mm/dd/yyyy).";

	const latestRaw = fields.pickupLatest?.trim() || "";
	if (latestRaw) {
		const latest = parseLoadBoardUsDate(latestRaw);
		if (!latest) return "Pick up latest must be a valid date (mm/dd/yyyy).";
		const earliestMs = Date.UTC(earliest.year, earliest.month - 1, earliest.day);
		const latestMs = Date.UTC(latest.year, latest.month - 1, latest.day);
		if (latestMs < earliestMs) {
			return "Pick up latest cannot be before Pick up earliest.";
		}
	}

	const hoursRaw = fields.pickupHours?.trim() || "";
	if (hoursRaw) {
		const { start, end } = parseLoadBoardHoursField(hoursRaw);
		const looksLikeRange = HOURS_RANGE_SEPARATORS.some((sep) =>
			hoursRaw.includes(sep),
		);
		if (!start || (looksLikeRange && !end)) {
			return "Pick up hours must be a valid time (e.g. 12:00 pm or 10:00 am — 02:00 pm).";
		}
		if (end && end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
			return "Pick up hours end time must be after start time.";
		}
	}

	const deliveryEarliestRaw = fields.deliveryEarliest?.trim() || "";
	const deliveryLatestRaw = fields.deliveryLatest?.trim() || "";
	let deliveryEarliest: ReturnType<typeof parseLoadBoardUsDate> = null;
	if (deliveryEarliestRaw) {
		deliveryEarliest = parseLoadBoardUsDate(deliveryEarliestRaw);
		if (!deliveryEarliest) {
			return "Delivery earliest must be a valid date (mm/dd/yyyy).";
		}
	}
	if (deliveryLatestRaw) {
		const deliveryLatest = parseLoadBoardUsDate(deliveryLatestRaw);
		if (!deliveryLatest) {
			return "Delivery latest must be a valid date (mm/dd/yyyy).";
		}
		if (deliveryEarliest) {
			const earliestMs = Date.UTC(
				deliveryEarliest.year,
				deliveryEarliest.month - 1,
				deliveryEarliest.day,
			);
			const latestMs = Date.UTC(
				deliveryLatest.year,
				deliveryLatest.month - 1,
				deliveryLatest.day,
			);
			if (latestMs < earliestMs) {
				return "Delivery latest cannot be before Delivery earliest.";
			}
		}
	}

	const dropOffRaw = fields.dropOffHours?.trim() || "";
	if (dropOffRaw) {
		const { start, end } = parseLoadBoardHoursField(dropOffRaw);
		const looksLikeRange = HOURS_RANGE_SEPARATORS.some((sep) =>
			dropOffRaw.includes(sep),
		);
		if (!start || (looksLikeRange && !end)) {
			return "Drop off hours must be a valid time (e.g. 12:00 pm or 10:00 am — 02:00 pm).";
		}
		if (end && end.hour * 60 + end.minute <= start.hour * 60 + start.minute) {
			return "Drop off hours end time must be after start time.";
		}
	}

	const deliveryDateRaw =
		fields.deliveryLatest?.trim() || fields.deliveryEarliest?.trim() || "";
	if (deliveryDateRaw) {
		const pickupDate = parseLoadBoardUsDate(fields.pickupEarliest?.trim() || "");
		const deliveryDate = parseLoadBoardUsDate(deliveryDateRaw);
		if (pickupDate && deliveryDate) {
			const pickupTime = parseLoadBoardHoursField(
				fields.pickupHours?.trim() || "",
			).start;
			const dropOff = parseLoadBoardHoursField(fields.dropOffHours?.trim() || "");
			const deliveryTime = dropOff.end ?? dropOff.start;
			const pickupMs = Date.UTC(
				pickupDate.year,
				pickupDate.month - 1,
				pickupDate.day,
				pickupTime?.hour ?? 0,
				pickupTime?.minute ?? 0,
				0,
			);
			const deliveryMs = Date.UTC(
				deliveryDate.year,
				deliveryDate.month - 1,
				deliveryDate.day,
				deliveryTime?.hour ?? 23,
				deliveryTime?.minute ?? 59,
				deliveryTime ? 0 : 59,
			);
			if (pickupMs > deliveryMs) {
				return "Pick up cannot be later than delivery.";
			}
		}
	}

	const deadline = resolveLoadBoardPickupDeadline(fields);
	if (!deadline) return "Unable to resolve pickup date/time.";
	if (deadline.getTime() < getNyNaiveNow().getTime()) {
		return "Pick up earliest / Pick up latest / Pick up hours cannot be in the past.";
	}
	return null;
}

