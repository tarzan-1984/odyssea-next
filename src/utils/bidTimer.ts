import {
	formatNyWallClockSqlString,
	parseNaiveNyDateTime,
} from "@/utils/nyWallClock";

export const BID_TIMER_SECONDS = 15 * 60;
export const BID_WARNING_SECONDS = 3 * 60;
export const BID_MAX_EXTEND_MS = 3 * BID_TIMER_SECONDS * 1000;

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

export function getNowNyNaiveMs(now: Date = new Date()): number {
	const parsed = parseNaiveNyDateTime(formatNyWallClockSqlString(now));
	return parsed?.getTime() ?? now.getTime();
}

/** Deadline = updated_at (NY wall-clock) + 15 minutes */
export function getBidExpiryNyNaiveMs(
	updatedAt: string | Date | null | undefined,
): number | null {
	const updated =
		updatedAt instanceof Date
			? updatedAt
			: parseNaiveNyDateTime(
					typeof updatedAt === "string" ? updatedAt : null,
				);
	if (!updated) return null;
	return updated.getTime() + BID_TIMER_SECONDS * 1000;
}

export function getBidRemainingSeconds(
	updatedAt: string | Date | null | undefined,
	nowNyNaiveMs: number,
): number | null {
	const expiryMs = getBidExpiryNyNaiveMs(updatedAt);
	if (expiryMs == null) return null;
	return Math.max(0, Math.floor((expiryMs - nowNyNaiveMs) / 1000));
}

/** Can extend while (updated_at - created_at) < 45 minutes (max 3 × 15 min). */
export function canExtendBidTime(
	createdAt: string | Date | null | undefined,
	updatedAt: string | Date | null | undefined,
): boolean {
	const created =
		createdAt instanceof Date
			? createdAt
			: parseNaiveNyDateTime(
					typeof createdAt === "string" ? createdAt : null,
				);
	const updated =
		updatedAt instanceof Date
			? updatedAt
			: parseNaiveNyDateTime(
					typeof updatedAt === "string" ? updatedAt : null,
				);
	if (!created || !updated) return false;
	return updated.getTime() - created.getTime() < BID_MAX_EXTEND_MS;
}
