import { isLastLocationOlderThanNy } from "@/utils/nyWallClock";
import { normalizeLoadChatStatus } from "@/utils/loadStatusLabel";

/** Same threshold as load tracking map. */
export const LOAD_CHAT_STALE_LOCATION_THRESHOLD = { minutes: 30 } as const;

/** Active load statuses where the chat stale-location banner applies. */
const LOAD_CHAT_STALE_LOCATION_STATUSES = new Set([
	"waiting-on-pu-date",
	"at-pu",
	"loaded-enroute",
]);

const MONTHS_LOWER = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
] as const;

export type LoadChatStaleLocationInput = {
	type?: string | null;
	loadStatus?: string | null;
	isRest?: boolean | null;
	lastLocationUpdateAt?: string | null;
};

/** True when staff should see the chat stale-location highlight/banner. */
export function isLoadChatLocationStale(
	input: LoadChatStaleLocationInput,
	nowMs: number = Date.now()
): boolean {
	if (String(input.type ?? "").toUpperCase() !== "LOAD") return false;
	if (input.isRest === true) return false;
	const status = normalizeLoadChatStatus(input.loadStatus);
	if (!LOAD_CHAT_STALE_LOCATION_STATUSES.has(status)) return false;
	const updatedAt = String(input.lastLocationUpdateAt ?? "").trim();
	if (!updatedAt) return false;
	return isLastLocationOlderThanNy(updatedAt, LOAD_CHAT_STALE_LOCATION_THRESHOLD);
	void nowMs;
}

function formatStaleLocationLastUpdateLabel(
	lastLocationUpdateAt: string | null | undefined
): string {
	const raw = String(lastLocationUpdateAt ?? "").trim();
	const match = raw.match(
		/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/
	);
	if (!match) return "N/A";
	const monthIndex = Number(match[2]) - 1;
	const day = Number(match[3]);
	let hour = Number(match[4]);
	const minute = match[5].padStart(2, "0");
	const month = MONTHS_LOWER[monthIndex] ?? "january";
	const ampm = hour >= 12 ? "PM" : "AM";
	hour = hour % 12;
	if (hour === 0) hour = 12;
	return `${day} ${month} ${hour}.${minute}${ampm} EST`;
}

/** Banner copy previously built on the server from isLocationStale latch. */
export function buildLoadChatStaleLocationAlert(
	lastLocationUpdateAt: string | null | undefined
): string {
	const lastUpdate = formatStaleLocationLastUpdateLabel(lastLocationUpdateAt);
	return `⚠️ No location updates for over 30 minutes. Last update: ${lastUpdate}.`;
}

export function resolveLoadChatStaleLocationAlert(
	input: LoadChatStaleLocationInput,
	nowMs: number = Date.now()
): string | null {
	if (!isLoadChatLocationStale(input, nowMs)) return null;
	return buildLoadChatStaleLocationAlert(input.lastLocationUpdateAt);
}
