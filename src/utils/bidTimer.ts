import { parseNaiveNyDateTime } from "@/utils/nyWallClock";

export const BID_TIMER_SECONDS = 15 * 60;
export const BID_WARNING_SECONDS = 3 * 60;
export const BID_MAX_EXTEND_SECONDS = 3 * BID_TIMER_SECONDS;
/** @deprecated use BID_MAX_EXTEND_SECONDS */
export const BID_MAX_EXTEND_MS = BID_MAX_EXTEND_SECONDS * 1000;

export function formatBidCountdown(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map(value => String(value).padStart(2, "0"))
		.join(":");
}

/** Green (full time) → red (near expiry). Hue 120 → 0. */
export function getBidTimerBackgroundColor(remainingSeconds: number): string {
	const ratio = Math.min(1, Math.max(0, remainingSeconds / BID_TIMER_SECONDS));
	const hue = Math.round(ratio * 120);
	return `hsl(${hue}, 72%, 42%)`;
}

export function getNowUnixSeconds(now: Date = new Date()): number {
	return Math.floor(now.getTime() / 1000);
}

function toUnixSeconds(
	value: number | string | Date | null | undefined,
): number | null {
	if (value == null) return null;
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.floor(value);
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (/^\d+$/.test(trimmed)) {
			return Number(trimmed);
		}
		const parsed = parseNaiveNyDateTime(trimmed);
		return parsed ? Math.floor(parsed.getTime() / 1000) : null;
	}
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return Math.floor(value.getTime() / 1000);
	}
	return null;
}

/**
 * Remaining seconds until expiry.
 * updated_at is unix seconds (bid_rates / bid_rate_participants).
 */
export function getBidRemainingSeconds(
	updatedAtUnix: number | string | Date | null | undefined,
	nowUnixSec: number = getNowUnixSeconds(),
): number | null {
	const updatedAtSec = toUnixSeconds(updatedAtUnix);
	if (updatedAtSec == null) return null;
	return Math.max(0, updatedAtSec + BID_TIMER_SECONDS - nowUnixSec);
}

/** Can extend while (updated_at - created_at) < 45 minutes (max 3 × 15 min). */
export function canExtendBidTime(
	createdAtUnix: number | string | Date | null | undefined,
	updatedAtUnix: number | string | Date | null | undefined,
): boolean {
	const createdAtSec = toUnixSeconds(createdAtUnix);
	const updatedAtSec = toUnixSeconds(updatedAtUnix);
	if (createdAtSec == null || updatedAtSec == null) return false;
	return updatedAtSec - createdAtSec < BID_MAX_EXTEND_SECONDS;
}

/** Aliases used by +1 participant UI. */
export const getBidParticipantRemainingSeconds = getBidRemainingSeconds;
export const canExtendBidParticipantTime = canExtendBidTime;
