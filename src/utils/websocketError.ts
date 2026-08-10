/**
 * Socket.IO / Nest may deliver Error instances, Event-like objects, or plain payloads.
 * JSON.stringify(Error) === "{}", which Next.js shows in the dev overlay via console.error.
 */
export function formatWebSocketError(error: unknown): string {
	if (error == null) return "";
	if (typeof error === "string") return error.trim();
	if (error instanceof Error) return error.message.trim();
	if (typeof error === "object") {
		const record = error as Record<string, unknown>;
		const message =
			typeof record.message === "string"
				? record.message
				: typeof record.error === "string"
					? record.error
					: "";
		const details = typeof record.details === "string" ? record.details : "";
		return [message, details].filter(Boolean).join(": ").trim();
	}
	return String(error).trim();
}

export function isMeaningfulWebSocketError(error: unknown): boolean {
	return formatWebSocketError(error).length > 0;
}

/** Prefer warn so Next.js dev overlay is not triggered for transient socket noise. */
export function logWebSocketError(label: string, error: unknown): void {
	const message = formatWebSocketError(error);
	if (!message) {
		if (process.env.NODE_ENV === "development") {
			console.warn(`${label}: (empty payload)`);
		}
		return;
	}
	console.warn(`${label}:`, message);
}
