export type AppLogRow = {
	id: string;
	loadId: string | null;
	action: string;
	source: string;
	data: unknown;
	createdAt: string;
};

export type AppLogsResponse = {
	logs: AppLogRow[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
};

export function formatAppLogData(data: unknown): string {
	if (data === null || data === undefined) return "—";
	if (typeof data === "string") return data;
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return value as JsonRecord;
}

function firstNonEmptyString(values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
		if (Array.isArray(value)) {
			for (const item of value) {
				if (typeof item === "string" && item.trim()) return item.trim();
			}
		}
	}
	return null;
}

/**
 * Builds `/chat?load=…&room=…` when the log payload shows a successfully created/updated chat.
 * Returns null when the chat was not created or ids are missing.
 */
export function getAppLogOpenChatHref(
	row: Pick<AppLogRow, "loadId" | "data">,
): string | null {
	const payload = asRecord(row.data);
	if (!payload) return null;

	const requestData = asRecord(payload.data);
	const result = asRecord(payload.result);
	if (!result || result.ok !== true) return null;

	const roomId = firstNonEmptyString([
		result.createdChatRoomIds,
		result.chatRoomIds,
		result.reusedChatRoomIds,
		result.existingChatRoomIds,
		result.sourceChatRoomId,
	]);
	if (!roomId) return null;

	const loadId = firstNonEmptyString([
		row.loadId,
		result.loadId,
		requestData?.load_id,
		requestData?.loadId,
	]);
	if (!loadId) return null;

	const params = new URLSearchParams({
		load: loadId,
		room: roomId,
	});
	return `/chat?${params.toString()}`;
}

/** Chat title from log payload `data.title` (request body nested under `data`). */
export function getAppLogTitle(data: unknown): string | null {
	const payload = asRecord(data);
	if (!payload) return null;
	const requestData = asRecord(payload.data);
	const title = firstNonEmptyString([
		requestData?.title,
		payload.title,
	]);
	return title;
}

/** True when log payload indicates chat create/update failed. */
export function isAppLogFailed(data: unknown): boolean {
	const payload = asRecord(data);
	if (!payload) return false;
	const result = asRecord(payload.result);
	if (!result) return false;
	if (result.ok === false) return true;
	if (typeof result.error === "string" && result.error.trim()) return true;
	return false;
}

/** Formats naive NY wall-clock `YYYY-MM-DD HH:mm:ss` for display. */
export function formatAppLogCreatedAt(value: string | null | undefined): string {
	if (!value) return "—";
	const match = value
		.trim()
		.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
	if (!match) return value;
	const [, year, month, day, hourStr, minute, second] = match;
	const hour24 = Number(hourStr);
	const hour12 = hour24 % 12 || 12;
	const ampm = hour24 >= 12 ? "PM" : "AM";
	return `${month}/${day}/${year}, ${String(hour12).padStart(2, "0")}:${minute}:${second} ${ampm}`;
}
