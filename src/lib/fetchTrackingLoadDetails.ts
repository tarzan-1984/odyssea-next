type TmsLoadBody = {
	success?: boolean;
	data?: {
		meta_data?: Record<string, unknown>;
		shippers?: unknown[];
		[key: string]: unknown;
	};
};

import { normalizeTrackingLoadDriver } from "@/utils/trackingLoadDriver";
import { mergeLoadRestFields } from "@/utils/mergeLoadRestFields";

type LoadEnrichment = {
	drivers?: unknown[];
	trackingPoints?: unknown[];
	routeGeocode?: unknown;
	loadRoute?: unknown;
	roadEta?: unknown;
	busyOnLoad?: unknown;
	isRest?: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
};

function unwrapEnrichmentBody(body: unknown): LoadEnrichment {
	if (!body || typeof body !== "object") return {};
	const root = body as Record<string, unknown>;
	const inner = root.data;
	if (inner && typeof inner === "object" && !Array.isArray(inner)) {
		const payload = inner as Record<string, unknown>;
		if (
			"drivers" in payload ||
			"trackingPoints" in payload ||
			"routeGeocode" in payload ||
			"loadRoute" in payload ||
			"roadEta" in payload ||
			"busyOnLoad" in payload ||
			"isRest" in payload ||
			"restDate" in payload ||
			"restStartedAt" in payload
		) {
			return inner as LoadEnrichment;
		}
	}
	if (
		"drivers" in root ||
		"trackingPoints" in root ||
		"routeGeocode" in root ||
		"loadRoute" in root ||
		"roadEta" in root ||
		"busyOnLoad" in root ||
		"isRest" in root ||
		"restDate" in root ||
		"restStartedAt" in root
	) {
		return root as LoadEnrichment;
	}
	return {};
}

function normalizeEnrichmentDrivers(drivers: unknown[]): Record<string, unknown>[] {
	return drivers
		.filter((d): d is Record<string, unknown> => Boolean(d) && typeof d === "object")
		.map(d => normalizeTrackingLoadDriver(d));
}

/** Shape expected by TrackingLoadPageClient (Nest-style wrapper). */
export type TrackingLoadDetailsPayload = {
	data: TmsLoadBody;
};

function unwrapTmsLoadBody(body: unknown): TmsLoadBody | null {
	if (!body || typeof body !== "object") return null;

	let current = body as Record<string, unknown>;
	for (let i = 0; i < 4; i++) {
		const inner = current.data;
		if (!inner || typeof inner !== "object" || Array.isArray(inner)) break;
		const rec = inner as Record<string, unknown>;
		if ("meta_data" in rec || "shippers" in rec) {
			return { success: true, data: rec };
		}
		current = rec;
	}

	if ("meta_data" in current || "shippers" in current) {
		return { success: true, data: current };
	}

	return null;
}

async function fetchTmsLoad(loadId: string, publicView: boolean): Promise<TmsLoadBody> {
	const tmsUrl = publicView
		? `/api/tms/load/${encodeURIComponent(loadId)}?public=1`
		: `/api/tms/load/${encodeURIComponent(loadId)}`;

	const tmsResponse = await fetch(tmsUrl);
	const tmsJson = (await tmsResponse.json().catch(() => null)) as
		| TmsLoadBody
		| { error?: string }
		| null;

	if (!tmsResponse.ok) {
		throw new Error(
			(tmsJson as { error?: string })?.error ||
				`Failed to fetch load from TMS: ${tmsResponse.status}`
		);
	}

	const unwrapped = unwrapTmsLoadBody(tmsJson);
	if (!unwrapped?.data) {
		throw new Error("TMS returned empty load data");
	}

	return unwrapped;
}

async function fetchLoadEnrichment(
	loadId: string,
	metaData: Record<string, unknown>,
	shippers: unknown[] | undefined,
	publicView: boolean
): Promise<LoadEnrichment> {
	const enrichUrl = publicView
		? `/api/public/tracking/load/${encodeURIComponent(loadId)}/enrichment`
		: `/api/tms/load/${encodeURIComponent(loadId)}/enrichment`;

	const enrichResponse = await fetch(enrichUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			meta_data: metaData,
			...(Array.isArray(shippers) && shippers.length > 0 ? { shippers } : {}),
		}),
	});

	const enrichWrapped = await enrichResponse.json().catch(() => null);

	if (!enrichResponse.ok) {
		const err =
			(enrichWrapped as { error?: string })?.error ||
			(enrichWrapped as { message?: string })?.message ||
			`Failed to fetch load enrichment: ${enrichResponse.status}`;
		throw new Error(err);
	}

	const payload = unwrapEnrichmentBody(enrichWrapped);
	const drivers = Array.isArray(payload.drivers)
		? normalizeEnrichmentDrivers(payload.drivers)
		: [];

	return {
		...payload,
		drivers,
	};
}

export async function fetchTrackingLoadDetails(
	loadId: string,
	options?: { publicView?: boolean }
): Promise<TrackingLoadDetailsPayload> {
	const publicView = Boolean(options?.publicView);

	const tmsJson = await fetchTmsLoad(loadId, publicView);
	const enrichment = await fetchLoadEnrichment(
		loadId,
		tmsJson.data?.meta_data ?? {},
		Array.isArray(tmsJson.data?.shippers) ? tmsJson.data.shippers : undefined,
		publicView
	);

	console.group(`[TrackingLoadPage] fetch load ${loadId} (${publicView ? "public" : "auth"})`);
	console.log("TMS response", tmsJson);
	console.log("Enrichment response", enrichment);
	console.groupEnd();

	return {
		data: {
			...tmsJson,
			data: {
				...tmsJson.data,
				drivers: enrichment.drivers ?? [],
				trackingPoints: enrichment.trackingPoints ?? [],
				routeGeocode: enrichment.routeGeocode ?? null,
				loadRoute: enrichment.loadRoute ?? [],
				roadEta: enrichment.roadEta ?? null,
				busyOnLoad: enrichment.busyOnLoad ?? null,
				isRest: enrichment.isRest === true,
				restDate: typeof enrichment.restDate === "string" ? enrichment.restDate : null,
				restStartedAt:
					typeof enrichment.restStartedAt === "string" ? enrichment.restStartedAt : null,
			},
		},
	};
}

export type TrackingLoadRestPatch = {
	isRest: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
};

function restFieldsFromTrackingDetails(details: Record<string, unknown>): {
	isRest?: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
} {
	const data =
		details.data && typeof details.data === "object"
			? (details.data as Record<string, unknown>)
			: null;
	const nested =
		data?.data && typeof data.data === "object"
			? (data.data as Record<string, unknown>)
			: null;
	return {
		isRest: Boolean(nested?.isRest ?? data?.isRest ?? details.isRest),
		restDate: (nested?.restDate ?? data?.restDate ?? details.restDate) as
			| string
			| null
			| undefined,
		restStartedAt: (nested?.restStartedAt ??
			data?.restStartedAt ??
			details.restStartedAt) as string | null | undefined,
	};
}

export function patchTrackingLoadDetailsRest<T>(
	details: T,
	update: TrackingLoadRestPatch,
): T {
	if (!details || typeof details !== "object") return details;
	const root = details as Record<string, unknown>;
	const merged = mergeLoadRestFields(restFieldsFromTrackingDetails(root), update);
	const restDate = merged.restDate ?? null;
	const restStartedAt = merged.restStartedAt ?? null;
	const data =
		root.data && typeof root.data === "object"
			? (root.data as Record<string, unknown>)
			: null;
	if (!data) {
		return {
			...root,
			isRest: merged.isRest,
			restDate,
			restStartedAt,
		} as T;
	}
	const nested =
		data.data && typeof data.data === "object"
			? (data.data as Record<string, unknown>)
			: null;
	return {
		...root,
		data: {
			...data,
			isRest: merged.isRest,
			restDate,
			restStartedAt,
			...(nested
				? {
						data: {
							...nested,
							isRest: merged.isRest,
							restDate,
							restStartedAt,
						},
					}
				: {}),
		},
	} as T;
}
