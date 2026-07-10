"use client";

import { useEffect, useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchDriversPage } from "@/components/tables/DataTables/DriversTable/driversListQueryOptions";
import type { DriversListQueryParams } from "@/components/tables/DataTables/DriversTable/driversListQueryOptions";
import type { DimensionsFilterValues } from "@/components/tables/DataTables/DriversTable/dimensionsFilterUtils";
import { getActiveDimensionsQueryParams } from "@/components/tables/DataTables/DriversTable/dimensionsFilterUtils";

const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes
const PAGE_SIZE = 60;

export interface DriverForMap {
	id: string;
	externalId: string | null;
	latitude: number;
	longitude: number;
	driverStatus: string | null;
	status?: string | null;
	zip?: string | null;
	activateApplication?: string | number | boolean | null;
}

export interface DriversMapFilterParams {
	capabilitiesFilter: string[];
	addressFilter: string;
	extendedSearchEnabled?: boolean;
	extendedSearchFilter?: string;
	radiusFilter: string;
	locationFilter: "USA" | "Canada";
	statusFilter: string;
	statusAutoAppliedByAddress?: boolean;
	dimensionsFilter?: DimensionsFilterValues;
	role: string;
	/** When false, query is disabled (same as drivers-list: only fetch when address set for non-admin). */
	enabled?: boolean;
}

/** Maps a raw TMS Driver record to DriverForMap for use on the map. */
function mapDriverToDriverForMap(driver: {
	id: string;
	meta_data?: {
		latitude?: string;
		longitude?: string;
		driver_status?: string;
		current_zipcode?: string;
		driver_id?: string;
		activate_application?: string | number | boolean | null;
	};
	status_post?: string;
}): DriverForMap | null {
	const lat = parseFloat(driver.meta_data?.latitude ?? "");
	const lng = parseFloat(driver.meta_data?.longitude ?? "");

	if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

	return {
		id: driver.id,
		externalId: driver.meta_data?.driver_id ?? driver.id ?? null,
		latitude: lat,
		longitude: lng,
		driverStatus: driver.meta_data?.driver_status ?? null,
		status: driver.status_post ?? null,
		zip: driver.meta_data?.current_zipcode ?? null,
		activateApplication: driver.meta_data?.activate_application ?? null,
	};
}

/**
 * Hook to fetch all drivers for map display using the same API as drivers-list.
 * Loads drivers in pages of 20, auto-fetches all pages so they appear gradually on the map.
 * Applies filters (status, address/radius/location, capabilities).
 * Cache time: 10 minutes.
 * Pass enabled=false to skip fetching (when data is provided externally via props).
 */
export function useDriversForMap(filters?: Partial<DriversMapFilterParams>, enabledProp = true) {
	const baseParams: Omit<DriversListQueryParams, "currentPage"> = {
		itemsPerPage: PAGE_SIZE,
		capabilitiesFilter: filters?.capabilitiesFilter ?? [],
		addressFilter: filters?.addressFilter ?? "",
		extendedSearchEnabled: filters?.extendedSearchEnabled ?? false,
		extendedSearchFilter: filters?.extendedSearchFilter ?? "",
		radiusFilter: filters?.radiusFilter ?? "500",
		locationFilter: filters?.locationFilter ?? "USA",
		statusFilter: filters?.statusFilter ?? "all",
		statusAutoAppliedByAddress: filters?.statusAutoAppliedByAddress ?? false,
		...(Object.keys(getActiveDimensionsQueryParams(filters?.dimensionsFilter)).length > 0
			? { dimensionsFilter: filters?.dimensionsFilter }
			: {}),
		role: filters?.role ?? "",
	};

	const enabled = filters?.enabled !== undefined ? filters.enabled : enabledProp;

	const query = useInfiniteQuery({
		queryKey: [
			"drivers-map",
			{
				capabilitiesFilter: baseParams.capabilitiesFilter,
				addressFilter: baseParams.addressFilter,
				extendedSearchEnabled: baseParams.extendedSearchEnabled ?? false,
				extendedSearchFilter: baseParams.extendedSearchFilter?.trim() ?? "",
				radiusFilter: baseParams.radiusFilter,
				locationFilter: baseParams.locationFilter,
				statusFilter: baseParams.statusFilter,
				statusAutoAppliedByAddress: baseParams.statusAutoAppliedByAddress ?? false,
				dimensionsFilter: getActiveDimensionsQueryParams(baseParams.dimensionsFilter),
				role: baseParams.role,
			},
		],
		queryFn: ({ pageParam }) =>
			fetchDriversPage({ ...baseParams, currentPage: pageParam }),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const pagination = lastPage.data?.pagination;
			if (!pagination) return undefined;
			const { current_page, total_pages } = pagination;
			if (current_page < total_pages) return current_page + 1;
			return undefined;
		},
		staleTime: STALE_TIME_MS,
		enabled,
	});

	const { hasNextPage, fetchNextPage, isFetchingNextPage } = query;

	// Auto-fetch all pages so drivers appear gradually on the map
	useEffect(() => {
		if (hasNextPage && !isFetchingNextPage) {
			fetchNextPage().catch(() => undefined);
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const rawDrivers: DriverForMap[] = (query.data?.pages ?? [])
		.flatMap((page) => page.data?.results ?? [])
		.map((d) => mapDriverToDriverForMap(d as Parameters<typeof mapDriverToDriverForMap>[0]))
		.filter((d): d is DriverForMap => d !== null);

	// Same client-side status filter as drivers-list
	const allDrivers = useMemo(() => {
		const statusFilter = baseParams.statusFilter;
		if (!statusFilter || statusFilter === "all" || statusFilter === "for_offers") {
			return rawDrivers;
		}
		return rawDrivers.filter(
			d => (d.driverStatus ?? "").trim().toLowerCase() === statusFilter.toLowerCase()
		);
	}, [rawDrivers, baseParams.statusFilter]);

	return {
		drivers: allDrivers,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		isFetchingNextPage,
		error: query.error,
		refetch: query.refetch,
	};
}
