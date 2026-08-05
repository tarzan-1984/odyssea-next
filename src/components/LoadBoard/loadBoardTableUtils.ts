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

export function formatPickupColumn(shipment: LoadBoardShipment): string {
	const date = shipment.pickupEarliest?.trim() || "";
	const hours = shipment.pickupHours?.trim() || "";
	if (!date) return "—";
	return hours ? `${date} ${hours}` : date;
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
