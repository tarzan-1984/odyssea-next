export const TMS_LOAD_PAGE_URL = "https://www.endurance-tms.com/add-load/";

export type BusyOnOtherLoad = {
	loadId: number;
	referenceNumber: string | null;
};

export function parseBusyOnOtherLoad(value: unknown): BusyOnOtherLoad | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const rec = value as Record<string, unknown>;
	const loadIdRaw = rec.loadId ?? rec.load_id;
	const loadId =
		typeof loadIdRaw === "number"
			? loadIdRaw
			: typeof loadIdRaw === "string"
				? Number(loadIdRaw)
				: NaN;
	if (!Number.isFinite(loadId) || loadId <= 0) return null;
	const reference =
		typeof rec.referenceNumber === "string"
			? rec.referenceNumber.trim()
			: typeof rec.reference_number === "string"
				? rec.reference_number.trim()
				: "";
	return {
		loadId: Math.round(loadId),
		referenceNumber: reference || null,
	};
}

export function busyOnOtherLoadRefLabel(busy: BusyOnOtherLoad): string {
	return busy.referenceNumber?.trim() || String(busy.loadId);
}

export function busyOnOtherLoadHref(busy: BusyOnOtherLoad): string {
	return `${TMS_LOAD_PAGE_URL}?post_id=${encodeURIComponent(String(busy.loadId))}`;
}
