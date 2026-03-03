"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDriversForMap } from "@/hooks/useDriversForMap";
import { DriversMapFilters } from "./DriversMapFilters";
import { useCurrentUser } from "@/stores/userStore";
import { DRIVER_STATUS_FILTER_OPTIONS } from "@/components/logistics/driversMapConstants";

const DriversMapWithMarkers = dynamic(
	() => import("@/components/logistics/DriversMapWithMarkers"),
	{ ssr: false }
);

export function DriversMapPageClient() {
	const currentUser = useCurrentUser();

	// Filter state — same as drivers-list
	const [driverStatusFilter, setDriverStatusFilter] = useState<string>("all");
	const [capabilitiesFilter, setCapabilitiesFilter] = useState<string[]>([]);
	const [zipFilter, setZipFilter] = useState<string>("");
	const [locationFilter, setLocationFilter] = useState<"USA" | "Canada">("USA");
	const [radiusFilter, setRadiusFilter] = useState<string>("500");
	const [centerCoordinates, setCenterCoordinates] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [radiusMiles, setRadiusMiles] = useState<number | null>(null);

	const { drivers, isLoading, isFetching, error, refetch } = useDriversForMap({
		statusFilter: driverStatusFilter === "all" ? "" : driverStatusFilter,
		capabilitiesFilter,
		addressFilter: zipFilter,
		radiusFilter,
		locationFilter,
		role: currentUser?.role?.toLowerCase() ?? "administrator",
	});

	// Fixed status options - same as drivers-list (never derived from current results)
	const driverStatusOptions = useMemo(() => [...DRIVER_STATUS_FILTER_OPTIONS], []);

	const handleFilterApply = useCallback(
		({ latitude, longitude, radiusMiles: miles }: { latitude: number; longitude: number; radiusMiles: number }) => {
			setCenterCoordinates({ lat: latitude, lng: longitude });
			setRadiusMiles(miles);
		},
		[]
	);

	const handleRadiusChange = useCallback((miles: number) => {
		setRadiusMiles(miles);
	}, []);

	const handleClearFilter = useCallback(() => {
		setCenterCoordinates(null);
		setRadiusMiles(null);
	}, []);

	const handleReset = useCallback(() => {
		setCapabilitiesFilter([]);
		setCenterCoordinates(null);
		setRadiusMiles(null);
	}, []);

	return (
		<div className="flex flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 md:gap-3 md:px-0 md:py-0">
			<PageBreadcrumb
				pageTitle="Drivers Map"
			/>

			<div className="relative z-[1000]">
				<DriversMapFilters
				driverStatusFilter={driverStatusFilter}
				setDriverStatusFilter={setDriverStatusFilter}
				driverStatusOptions={driverStatusOptions}
				capabilitiesFilter={capabilitiesFilter}
				setCapabilitiesFilter={setCapabilitiesFilter}
				zipFilter={zipFilter}
				setZipFilter={setZipFilter}
				locationFilter={locationFilter}
				setLocationFilter={setLocationFilter}
				radiusFilter={radiusFilter}
				setRadiusFilter={setRadiusFilter}
				onFilterApply={handleFilterApply}
				onRadiusChange={handleRadiusChange}
				onClearFilter={handleClearFilter}
				onReset={handleReset}
			/>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:rounded-2xl">
				<div className="h-[calc(100vh-260px)] min-h-[320px] sm:h-[calc(100vh-240px)] sm:min-h-[420px] md:h-[calc(100vh-220px)] md:min-h-[480px] lg:h-[calc(100vh-190px)] lg:min-h-[520px]">
					<DriversMapWithMarkers
						drivers={drivers}
						isLoading={isLoading}
						isFetching={isFetching}
						error={error}
						refetch={refetch}
						driverStatusFilter={driverStatusFilter}
						onDriverStatusFilterChange={setDriverStatusFilter}
						zipFilter={zipFilter}
						onZipFilterChange={setZipFilter}
						centerCoordinates={centerCoordinates}
						radiusMiles={radiusMiles}
						hideFilterBar
					/>
				</div>
			</div>
		</div>
	);
}
