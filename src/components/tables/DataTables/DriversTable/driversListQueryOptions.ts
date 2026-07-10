import axios from "axios";
import type { DriversPage } from "./Types";
import {
	getActiveDimensionsQueryParams,
	type DimensionsFilterValues,
} from "./dimensionsFilterUtils";

export interface DriversListQueryParams {
	currentPage: number;
	itemsPerPage: number;
	capabilitiesFilter: string[];
	addressFilter: string;
	extendedSearchEnabled?: boolean;
	extendedSearchFilter?: string;
	radiusFilter: string;
	locationFilter: "USA" | "Canada";
	statusFilter: string;
	/** True when status was auto-set to for_offers because address was entered */
	statusAutoAppliedByAddress?: boolean;
	dimensionsFilter?: DimensionsFilterValues;
	role: string;
}

const STALE_TIME_MS = 10 * 60 * 1000;

/**
 * Resolve status_filter for TMS.
 * Uses the selected TMS status key (available, available_on, for_offers, …).
 * "all" / empty → omit status_filter entirely (show every status).
 * Address auto-selects Default (for_offers) in UI; if user then picks All statuses, nothing is sent.
 */
export function resolveStatusFilterForQuery(
	_addressFilter: string,
	statusFilter: string,
	_statusAutoAppliedByAddress = false
): string {
	const trimmed = statusFilter?.trim() ?? "";
	if (!trimmed || trimmed === "all") return "";
	return trimmed;
}

export async function fetchDriversPage(
	params: DriversListQueryParams
): Promise<DriversPage> {
	const {
		currentPage,
		itemsPerPage,
		capabilitiesFilter,
		addressFilter,
		extendedSearchEnabled = false,
		extendedSearchFilter = "",
		radiusFilter,
		locationFilter,
		statusFilter,
		dimensionsFilter,
		role,
	} = params;

	const searchParams = new URLSearchParams();
	searchParams.set("paged", String(currentPage));
	searchParams.set("per_page_loads", String(itemsPerPage));

	if (capabilitiesFilter.length) {
		searchParams.set("capabilities", capabilitiesFilter.join(","));
	}

	if(role) {
		searchParams.set("role", "administrator");
	}

	const trimmedExtendedSearch = extendedSearchFilter?.trim() ?? "";
	if (extendedSearchEnabled && trimmedExtendedSearch) {
		searchParams.set("extended_search", trimmedExtendedSearch);
		if (radiusFilter) {
			searchParams.set("radius", radiusFilter);
		}
		if (locationFilter) {
			searchParams.set("country", locationFilter);
		}
	} else if (addressFilter && radiusFilter && locationFilter) {
		searchParams.set("my_search", addressFilter);
		searchParams.set("radius", radiusFilter);
		searchParams.set("country", locationFilter);
	}

	const effectiveStatusFilter = resolveStatusFilterForQuery(
		addressFilter,
		statusFilter,
		params.statusAutoAppliedByAddress
	);
	if (effectiveStatusFilter) {
		searchParams.set("status_filter", effectiveStatusFilter);
	}

	const activeDimensions = getActiveDimensionsQueryParams(dimensionsFilter);
	if (activeDimensions.dim_min_1) {
		searchParams.set("dim_min_1", activeDimensions.dim_min_1);
	}
	if (activeDimensions.dim_min_2) {
		searchParams.set("dim_min_2", activeDimensions.dim_min_2);
	}
	if (activeDimensions.dim_min_3) {
		searchParams.set("dim_min_3", activeDimensions.dim_min_3);
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
	const effectiveStatusFilter = resolveStatusFilterForQuery(
		params.addressFilter,
		params.statusFilter,
		params.statusAutoAppliedByAddress
	);
	return [
		"drivers-list",
		{
			currentPage: params.currentPage,
			itemsPerPage: params.itemsPerPage,
			capabilitiesFilter: params.capabilitiesFilter,
			addressFilter: params.addressFilter,
			extendedSearchEnabled: params.extendedSearchEnabled ?? false,
			extendedSearchFilter: params.extendedSearchFilter?.trim() ?? "",
			radiusFilter: params.radiusFilter,
			locationFilter: params.locationFilter,
			statusFilter: effectiveStatusFilter,
			dimensionsFilter: getActiveDimensionsQueryParams(params.dimensionsFilter),
			role: params.role,
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
