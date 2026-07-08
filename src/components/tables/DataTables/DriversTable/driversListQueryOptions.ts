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
 * "all" / empty is omitted; address search defaults to for_offers when that was auto-applied.
 */
export function resolveStatusFilterForQuery(
	addressFilter: string,
	statusFilter: string,
	statusAutoAppliedByAddress = false
): string {
	const trimmed = statusFilter?.trim() ?? "";
	if (trimmed && trimmed !== "all") {
		return trimmed;
	}
	const hasAddress = Boolean(addressFilter.trim());
	if (hasAddress && statusAutoAppliedByAddress) return "for_offers";
	return "";
}

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

	if (addressFilter && radiusFilter && locationFilter) {
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
