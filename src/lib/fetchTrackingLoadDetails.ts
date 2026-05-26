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

export async function fetchTrackingLoadDetails(
	loadId: string
): Promise<TrackingLoadDetailsPayload> {
	const tmsResponse = await fetch(`/api/tms/load/${encodeURIComponent(loadId)}`);
	const tmsJson = (await tmsResponse.json().catch(() => null)) as
		| TmsLoadBody
		| {
				error?: string;
		  }
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

	const enrichResponse = await fetch(`/api/tms/load/${encodeURIComponent(loadId)}/enrichment`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ meta_data: tmsJson.data.meta_data ?? {} }),
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

	const enrichment = enrichWrapped?.data ?? {};

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
