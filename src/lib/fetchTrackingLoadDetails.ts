type TmsLoadBody = {
	success?: boolean;
	data?: {
		meta_data?: Record<string, unknown>;
		shippers?: unknown[];
		[key: string]: unknown;
	};
};

import { normalizeTrackingLoadDriver } from "@/utils/trackingLoadDriver";

type LoadEnrichment = {
	drivers?: unknown[];
	trackingPoints?: unknown[];
	routeGeocode?: unknown;
};

function unwrapEnrichmentBody(body: unknown): LoadEnrichment {
	if (!body || typeof body !== "object") return {};
	const root = body as Record<string, unknown>;
	const inner = root.data;
	if (inner && typeof inner === "object" && !Array.isArray(inner)) {
		const payload = inner as Record<string, unknown>;
		if ("drivers" in payload || "trackingPoints" in payload || "routeGeocode" in payload) {
			return inner as LoadEnrichment;
		}
	}
	if ("drivers" in root || "trackingPoints" in root || "routeGeocode" in root) {
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

	if (!tmsJson || !("data" in tmsJson) || !tmsJson.data) {
		throw new Error("TMS returned empty load data");
	}

	return tmsJson;
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

	return {
		data: {
			...tmsJson,
			data: {
				...tmsJson.data,
				drivers: enrichment.drivers ?? [],
				trackingPoints: enrichment.trackingPoints ?? [],
				routeGeocode: enrichment.routeGeocode ?? null,
			},
		},
	};
}
