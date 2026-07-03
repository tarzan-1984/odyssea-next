export const TMS_DRIVER_PAGE_URL = "https://www.endurance-tms.com/add-driver/";
export const TMS_DRIVER_LOCATION_TAB = "pills-driver-location-tab";
export const TMS_DRIVER_RATINGS_TAB = "pills-driver-ratings-tab";

export function buildTmsDriverPageUrl(
	externalId: string | null | undefined,
	tab?: string,
): string | null {
	const id = externalId?.trim();
	if (!id) return null;
	const params = new URLSearchParams({ driver: id });
	const tabValue = tab?.trim();
	if (tabValue) {
		params.set("tab", tabValue);
	}
	return `${TMS_DRIVER_PAGE_URL}?${params.toString()}`;
}
