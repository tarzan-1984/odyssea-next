import axios from "axios";
import type { DriversPage } from "./Types";

export interface DriversListQueryParams {
	currentPage: number;
	itemsPerPage: number;
	capabilitiesFilter: string[];
	addressFilter: string;
	radiusFilter: string;
	locationFilter: "USA" | "Canada";
	statusFilter: string;
}

const STALE_TIME_MS = 10 * 60 * 1000;

export async function fetchDriversPage(
	params: DriversListQueryParams
): Promise<DriversPage> {
	const {
		currentPage,
		itemsPerPage,
		capabilitiesFilter,
		addressFilter,
		radiusFilter,
		locationFilter,
		statusFilter,
	} = params;

	const searchParams = new URLSearchParams();
	searchParams.set("paged", String(currentPage));
	searchParams.set("per_page_loads", String(itemsPerPage));

	if (capabilitiesFilter.length) {
		searchParams.set("capabilities", capabilitiesFilter.join(","));
	}

	if (addressFilter && radiusFilter && locationFilter) {
		searchParams.set("my_search", addressFilter);
		searchParams.set("radius", radiusFilter);
		searchParams.set("country", locationFilter);
	} else if (!addressFilter && statusFilter) {
		searchParams.set("extended_search", statusFilter);
	}

	try {
		const { data } = await axios.get<DriversPage>(
			`/api/users/drivers/search?${searchParams.toString()}`,
			{ withCredentials: true }
		);
		return data;
	} catch (error: unknown) {
		const message =
			(error as { response?: { data?: { error?: string }; message?: string } })?.response
				?.data?.error ||
			(error as { message?: string })?.message ||
			"Failed to fetch drivers";
		throw new Error(message);
	}
}

export function driversListQueryKey(params: DriversListQueryParams) {
	return [
		"drivers-list",
		{
			currentPage: params.currentPage,
			itemsPerPage: params.itemsPerPage,
			capabilitiesFilter: params.capabilitiesFilter,
			addressFilter: params.addressFilter,
			radiusFilter: params.radiusFilter,
			locationFilter: params.locationFilter,
			statusFilter: params.statusFilter,
		},
	] as const;
}

export function driversListQueryOptions(params: DriversListQueryParams) {
	return {
		queryKey: driversListQueryKey(params),
		queryFn: () => fetchDriversPage(params),
		staleTime: STALE_TIME_MS,
	};
}
