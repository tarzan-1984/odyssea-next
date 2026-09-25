export const UNDO_SEND_DELAY_MIN_SECONDS = 0;
export const UNDO_SEND_DELAY_MAX_SECONDS = 30;
export const UNDO_SEND_DELAY_DEFAULT_SECONDS = 0;

export function clampUndoSendDelaySeconds(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) return UNDO_SEND_DELAY_DEFAULT_SECONDS;
	return Math.min(
		UNDO_SEND_DELAY_MAX_SECONDS,
		Math.max(UNDO_SEND_DELAY_MIN_SECONDS, Math.round(n))
	);
}

export function formatUndoSendDelayLabel(seconds: number): string {
	const clamped = clampUndoSendDelaySeconds(seconds);
	if (clamped === 0) return "Off";
	return `${clamped}s`;
}
