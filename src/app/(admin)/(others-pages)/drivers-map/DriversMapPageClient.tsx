"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDriversForMap } from "@/hooks/useDriversForMap";
import { DriversMapFilters } from "./DriversMapFilters";

const DriversMapWithMarkers = dynamic(
	() => import("@/components/logistics/DriversMapWithMarkers"),
	{ ssr: false }
);

export function DriversMapPageClient() {
	const { drivers, isLoading, isFetching, error, refetch } = useDriversForMap();
	const [driverStatusFilter, setDriverStatusFilter] = useState<string>("all");
	const [zipFilter, setZipFilter] = useState<string>("");
	const [centerCoordinates, setCenterCoordinates] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [radiusMiles, setRadiusMiles] = useState<number | null>(null);

	const driverStatusOptions = Array.from(
		new Set(
			drivers
				.map((d) => d.driverStatus)
				.filter((s): s is string => Boolean(s))
				.sort()
		)
	);

	return (
		<div className="flex flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 md:gap-3 md:px-0 md:py-0">
			<PageBreadcrumb
				pageTitle="Drivers Map"
			/>

			<DriversMapFilters
				driverStatusFilter={driverStatusFilter}
				setDriverStatusFilter={setDriverStatusFilter}
				driverStatusOptions={driverStatusOptions}
				zipFilter={zipFilter}
				setZipFilter={setZipFilter}
				onFilterApply={({ latitude, longitude, radiusMiles: miles }) => {
					setCenterCoordinates({ lat: latitude, lng: longitude });
					setRadiusMiles(miles);
				}}
				onRadiusChange={(miles) => setRadiusMiles(miles)}
				onClearFilter={() => {
					setCenterCoordinates(null);
					setRadiusMiles(null);
				}}
				onReset={() => {
					setCenterCoordinates(null);
					setRadiusMiles(null);
				}}
			/>

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
