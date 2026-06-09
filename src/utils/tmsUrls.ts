export const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";

export function buildTmsDriverPageUrl(
	externalId: string | null | undefined
): string | null {
	const id = externalId?.trim();
	if (!id) return null;
	return `${TMS_DRIVER_PAGE_URL}?driver=${encodeURIComponent(id)}`;
}
