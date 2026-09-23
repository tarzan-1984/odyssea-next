import { formatNyWallClockSqlString, parseNaiveNyDateTime } from "./nyWallClock";

export type RestCountdownTone = "green" | "yellow" | "red";

const HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

function nyNaiveFromInstant(ms: number): Date | null {
	return parseNaiveNyDateTime(formatNyWallClockSqlString(new Date(ms)));
}

export function remainingRestMs(
	restDate: string | null | undefined,
	now = Date.now(),
): number {
	const endNy = parseNaiveNyDateTime(restDate);
	const nowNy = nyNaiveFromInstant(now);
	if (!endNy || !nowNy) return 0;
	return Math.max(0, endNy.getTime() - nowNy.getTime());
}

export function formatRestCountdown(remainingMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Green at the start of rest, yellow around the midpoint, red in the last third.
 * Falls back to remaining-time buckets when start is missing.
 */
export function restCountdownTone(
	remainingMs: number,
	restDate?: string | null,
	restStartedAt?: string | null,
): RestCountdownTone {
	if (remainingMs <= 0) return "red";

	const endNy = parseNaiveNyDateTime(restDate);
	const startNy = parseNaiveNyDateTime(restStartedAt);
	const total =
		endNy && startNy ? endNy.getTime() - startNy.getTime() : Number.NaN;
	if (Number.isFinite(total) && total > 0) {
		const ratio = remainingMs / total;
		if (ratio > 2 / 3) return "green";
		if (ratio > 1 / 3) return "yellow";
		return "red";
	}

	if (remainingMs > HOUR_MS) return "green";
	if (remainingMs > FIFTEEN_MIN_MS) return "yellow";
	return "red";
}
