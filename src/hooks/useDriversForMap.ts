"use client";

import { useEffect } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

const PAGE_SIZE = 100;
const STALE_TIME_MS = 10 * 60 * 1000; // 10 minutes

export interface DriverForMap {
	id: string;
	externalId: string | null;
	latitude: number;
	longitude: number;
	driverStatus: string | null;
	status?: string | null;
	zip?: string | null;
}

interface DriversMapPageResponse {
	drivers: DriverForMap[];
	pagination: {
		current_page: number;
		per_page: number;
		total_count: number;
		total_pages: number;
		has_next_page: boolean;
		has_prev_page: boolean;
	};
}

async function fetchDriversPage(page: number): Promise<DriversMapPageResponse> {
	const params = new URLSearchParams();
	params.set("page", String(page));
	params.set("limit", String(PAGE_SIZE));

	const response = await fetch(`/api/users/drivers/map?${params.toString()}`, {
		method: "GET",
		credentials: "include",
	});

	if (!response.ok) {
		const err = await response.json().catch(() => ({}));
		throw new Error(err.error || "Failed to fetch drivers");
	}

	return response.json();
}

/**
 * Hook to fetch all drivers for map display with pagination.
 * Uses TanStack Query useInfiniteQuery - fetches all pages and caches for 10 minutes.
 */
export function useDriversForMap() {
	const query = useInfiniteQuery({
		queryKey: ["drivers-map"],
		queryFn: ({ pageParam }) => fetchDriversPage(pageParam),
		initialPageParam: 1,
		getNextPageParam: lastPage => {
			const { pagination } = lastPage;
			if (pagination?.has_next_page) {
				return (pagination.current_page ?? 0) + 1;
			}
			return undefined;
		},
		staleTime: STALE_TIME_MS,
	});

	const { hasNextPage, fetchNextPage, isFetchingNextPage } = query;

	// Auto-fetch all pages when we have more data to load
	useEffect(() => {
		if (hasNextPage && !isFetchingNextPage) {
			fetchNextPage().catch(() => undefined);
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const allDrivers: DriverForMap[] = query.data?.pages.flatMap(p => p.drivers ?? []) ?? [];

	return {
		drivers: allDrivers,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		isFetchingNextPage,
		error: query.error,
		refetch: query.refetch,
	};
}
