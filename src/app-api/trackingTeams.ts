export type TrackingTeamsScope = "mine" | "team";

export type TrackingTeamsResponse = {
	success: boolean;
	loadIds: string[];
	total: number;
	includeSubordinates: boolean;
	cached?: boolean;
};

type TrackingTeamsApiPayload = {
	success?: boolean;
	loadIds?: Array<string | number>;
	load_ids?: Array<string | number>;
	data?: unknown;
	error?: string;
	message?: string;
	tmsStatus?: number | string | null;
	tmsUrl?: string | null;
	tmsBody?: unknown;
	detail?: unknown;
	nestStatus?: number;
	nestBody?: unknown;
};

export const TRACKING_TEAMS_QUERY_KEY = "tracking-teams" as const;

export const TRACKING_TEAMS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

export function trackingTeamsQueryKey(scope: TrackingTeamsScope) {
	return [TRACKING_TEAMS_QUERY_KEY, scope] as const;
}

/** Cache only non-empty TMS lists; empty/error results stay stale so the next visit refetches. */
export function trackingTeamsStaleTimeMs(data: unknown): number {
	if (Array.isArray(data) && data.length > 0) {
		return TRACKING_TEAMS_STALE_TIME_MS;
	}
	return 0;
}

function normalizeLoadIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(id => String(id ?? "").trim()).filter(Boolean);
}

/**
 * Nest TransformInterceptor wraps as `{ data: payload }`.
 * Next may unwrap once, or the client may still see `{ data: { data: { loadIds } } }`.
 * Walk nested `data` until loadIds / load_ids (or a raw id array) is found.
 */
export function extractTrackingTeamsLoadIds(payload: unknown): string[] {
	let current: unknown = payload;
	for (let depth = 0; depth < 5; depth++) {
		if (Array.isArray(current)) {
			return normalizeLoadIds(current);
		}
		if (!current || typeof current !== "object") {
			return [];
		}
		const obj = current as TrackingTeamsApiPayload;
		if (Array.isArray(obj.loadIds)) {
			return normalizeLoadIds(obj.loadIds);
		}
		if (Array.isArray(obj.load_ids)) {
			return normalizeLoadIds(obj.load_ids);
		}
		if ("data" in obj) {
			current = obj.data;
			continue;
		}
		return [];
	}
	return [];
}

/**
 * Fetch TMS tracking/teams load ids via Next proxy → Nest.
 * scope "mine" = My Loads; "team" = My Team (include_subordinates).
 */
export async function fetchTrackingTeamsLoadIds(
	scope: TrackingTeamsScope,
	options?: { refresh?: boolean },
): Promise<string[]> {
	const qs = new URLSearchParams();
	if (scope === "team") qs.set("include_subordinates", "1");
	if (options?.refresh) qs.set("refresh", "1");

	const response = await fetch(
		`/api/tracking/teams${qs.toString() ? `?${qs.toString()}` : ""}`,
		{
			method: "GET",
			credentials: "include",
			cache: "no-store",
		},
	);

	const data = (await response.json()) as TrackingTeamsApiPayload;

	if (!response.ok) {
		throw new Error(formatTrackingTeamsRequestError(data, response.status));
	}

	return extractTrackingTeamsLoadIds(data);
}

export function formatTrackingTeamsRequestError(
	payload: TrackingTeamsApiPayload,
	httpStatus: number,
): string {
	const tmsBody =
		payload.tmsBody == null
			? null
			: typeof payload.tmsBody === "string"
				? payload.tmsBody
				: JSON.stringify(payload.tmsBody, null, 2);
	return [
		payload.error || payload.message || `Failed to load tracking teams (${httpStatus})`,
		payload.tmsStatus != null ? `tmsStatus: ${payload.tmsStatus}` : null,
		payload.tmsUrl ? `tmsUrl: ${payload.tmsUrl}` : null,
		payload.detail != null ? `detail: ${String(payload.detail)}` : null,
		tmsBody ? `tmsBody: ${tmsBody}` : null,
	]
		.filter(Boolean)
		.join("\n");
}
