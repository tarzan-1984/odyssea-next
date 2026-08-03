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
	data?: {
		load_ids?: Array<string | number>;
		loadIds?: Array<string | number>;
	};
	error?: string;
	message?: string;
};

export const TRACKING_TEAMS_QUERY_KEY = "tracking-teams" as const;

export const TRACKING_TEAMS_STALE_TIME_MS = 24 * 60 * 60 * 1000;

export function trackingTeamsQueryKey(scope: TrackingTeamsScope) {
	return [TRACKING_TEAMS_QUERY_KEY, scope] as const;
}

function normalizeLoadIds(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(id => String(id ?? "").trim()).filter(Boolean);
}

/**
 * Prefer Nest `{ loadIds }`; also accept TMS-shaped `{ data: { load_ids } }` / `{ load_ids }`.
 */
export function extractTrackingTeamsLoadIds(payload: TrackingTeamsApiPayload): string[] {
	if (Array.isArray(payload?.loadIds)) {
		return normalizeLoadIds(payload.loadIds);
	}
	if (Array.isArray(payload?.load_ids)) {
		return normalizeLoadIds(payload.load_ids);
	}
	if (Array.isArray(payload?.data?.load_ids)) {
		return normalizeLoadIds(payload.data.load_ids);
	}
	if (Array.isArray(payload?.data?.loadIds)) {
		return normalizeLoadIds(payload.data.loadIds);
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
		throw new Error(data.error || data.message || "Failed to load tracking teams");
	}

	return extractTrackingTeamsLoadIds(data);
}
