type TmsLoadBody = {
	success?: boolean;
	data?: {
		meta_data?: Record<string, unknown>;
		[key: string]: unknown;
	};
};

type LoadEnrichment = {
	drivers?: unknown[];
	trackingPoints?: unknown[];
	routeGeocode?: unknown;
};

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
	publicView: boolean
): Promise<LoadEnrichment> {
	const enrichUrl = publicView
		? `/api/public/tracking/load/${encodeURIComponent(loadId)}/enrichment`
		: `/api/tms/load/${encodeURIComponent(loadId)}/enrichment`;

	const enrichResponse = await fetch(enrichUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ meta_data: metaData }),
	});

	const enrichWrapped = (await enrichResponse.json().catch(() => null)) as {
		data?: LoadEnrichment;
		error?: string;
	} | null;

	if (!enrichResponse.ok) {
		throw new Error(
			enrichWrapped?.error || `Failed to fetch load enrichment: ${enrichResponse.status}`
		);
	}

	return enrichWrapped?.data ?? {};
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
