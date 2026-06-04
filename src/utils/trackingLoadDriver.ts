/** Normalize driver id from TMS / DB (string | number). */
export function normalizeDriverExternalId(value: unknown): string {
	if (value == null) return "";
	return String(value).trim();
}

/** Normalize TMS load post id (`tracking_load_id` / `trackingLoadId`). */
export function normalizeTrackingLoadId(value: unknown): string {
	if (value == null) return "";
	return String(value).trim();
}

/** Read `last_active_app` from enrichment/API (camelCase or snake_case). */
export function pickLastActiveApp(driver: Record<string, unknown>): string | null {
	const raw = driver.lastActiveApp ?? driver.last_active_app;
	if (raw == null) return null;
	if (raw instanceof Date) {
		return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
	}
	if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
		return new Date(raw).toISOString();
	}
	const s = String(raw).trim();
	if (!s || s === "null" || s === "undefined") return null;
	return s;
}

export function normalizeTrackingLoadDriver<T extends Record<string, unknown>>(driver: T) {
	const rawTrackingLoadId = driver.trackingLoadId ?? driver.tracking_load_id;
	return {
		...driver,
		externalId: normalizeDriverExternalId(driver.externalId),
		trackingLoadId: normalizeTrackingLoadId(rawTrackingLoadId) || null,
		lastActiveApp: pickLastActiveApp(driver),
	};
}
