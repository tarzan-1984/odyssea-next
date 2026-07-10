"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import { useDriversForMap } from "@/hooks/useDriversForMap";
import { DriversMapFilters } from "./DriversMapFilters";
import { useCurrentUser } from "@/stores/userStore";
import { isRestrictedDriverStatusForMap } from "@/components/logistics/driversMapConstants";
import { canViewRestrictedDriverStatusesOnMap } from "@/utils/roleAccess";
import {
	createEmptyDimensionsFilter,
	type DimensionsFilterValues,
} from "@/components/tables/DataTables/DriversTable/dimensionsFilterUtils";

const DriversMapWithMarkers = dynamic(
	() => import("@/components/logistics/DriversMapWithMarkers"),
	{ ssr: false }
);

export function DriversMapPageClient() {
	const currentUser = useCurrentUser();

	const [extendedSearchEnabled, setExtendedSearchEnabled] = useState(false);
	const [addressFilter, setAddressFilter] = useState<string>("");
	const [debouncedAddressFilter, setDebouncedAddressFilter] = useState<string>("");
	const [extendedSearchFilter, setExtendedSearchFilter] = useState<string>("");
	const [debouncedExtendedSearchFilter, setDebouncedExtendedSearchFilter] =
		useState<string>("");
	const [locationFilter, setLocationFilter] = useState<"USA" | "Canada">("USA");
	const [radiusFilter, setRadiusFilter] = useState<string>("500");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [statusAutoAppliedByAddress, setStatusAutoAppliedByAddress] = useState(false);
	const [capabilitiesFilter, setCapabilitiesFilter] = useState<string[]>([]);
	const [dimensionsFilter, setDimensionsFilter] = useState<DimensionsFilterValues>(
		createEmptyDimensionsFilter
	);
	const [dimensionsModalOpen, setDimensionsModalOpen] = useState(false);
	const [centerCoordinates, setCenterCoordinates] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [radiusMiles, setRadiusMiles] = useState<number | null>(null);

	const handleExtendedSearchToggle = useCallback((enabled: boolean) => {
		setExtendedSearchEnabled(enabled);
		setAddressFilter("");
		setDebouncedAddressFilter("");
		setExtendedSearchFilter("");
		setDebouncedExtendedSearchFilter("");
		setStatusAutoAppliedByAddress(false);
		setCenterCoordinates(null);
		setRadiusMiles(null);
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedAddressFilter(addressFilter);
		}, 1500);
		return () => clearTimeout(timer);
	}, [addressFilter]);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedExtendedSearchFilter(extendedSearchFilter);
		}, 1500);
		return () => clearTimeout(timer);
	}, [extendedSearchFilter]);

	useEffect(() => {
		if (extendedSearchEnabled) return;
		if (addressFilter.trim()) {
			setStatusFilter("for_offers");
			setStatusAutoAppliedByAddress(true);
		} else {
			setStatusAutoAppliedByAddress(wasAuto => {
				if (wasAuto) {
					setStatusFilter(prev => (prev === "for_offers" ? "all" : prev));
				}
				return false;
			});
		}
	}, [addressFilter, extendedSearchEnabled]);

	const { drivers, isLoading, isFetching, error, refetch } = useDriversForMap({
		capabilitiesFilter,
		addressFilter: extendedSearchEnabled ? "" : debouncedAddressFilter,
		extendedSearchEnabled,
		extendedSearchFilter: extendedSearchEnabled ? debouncedExtendedSearchFilter : "",
		radiusFilter,
		locationFilter,
		statusFilter,
		statusAutoAppliedByAddress,
		dimensionsFilter,
		role: currentUser?.role?.toLowerCase() ?? "",
	});

	const canViewRestrictedStatuses = useMemo(
		() => canViewRestrictedDriverStatusesOnMap(currentUser?.role),
		[currentUser?.role]
	);

	const statusFilterOptions = useMemo(() => {
		const options: { value: string; label: string }[] = [
			{ value: "all", label: "All statuses" },
			{ value: "for_offers", label: "Default" },
			{ value: "available", label: "Available" },
			{ value: "available_on", label: "Available on" },
			{ value: "available_off", label: "Not available" },
			{ value: "loaded_enroute", label: "Loaded & Enroute" },
		];
		if (canViewRestrictedStatuses) {
			options.push(
				{ value: "banned", label: "Out of service" },
				{ value: "on_vocation", label: "On vacation" },
				{ value: "blocked", label: "Blocked" },
				{ value: "expired_documents", label: "Expired documents" }
			);
		} else {
			options.push(
				{ value: "on_vocation", label: "On vacation" },
				{ value: "expired_documents", label: "Expired documents" }
			);
		}
		return options;
	}, [canViewRestrictedStatuses]);

	const driversForMap = useMemo(() => {
		if (canViewRestrictedStatuses) return drivers;
		return drivers.filter(d => !isRestrictedDriverStatusForMap(d.driverStatus));
	}, [drivers, canViewRestrictedStatuses]);

	useEffect(() => {
		if (canViewRestrictedStatuses) return;
		if (statusFilter === "blocked" || statusFilter === "banned") {
			setStatusFilter("all");
		}
	}, [canViewRestrictedStatuses, statusFilter]);

	const handleFilterApply = useCallback(
		({
			latitude,
			longitude,
			radiusMiles: miles,
		}: {
			latitude: number;
			longitude: number;
			radiusMiles: number;
		}) => {
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
		handleExtendedSearchToggle(false);
		setAddressFilter("");
		setDebouncedAddressFilter("");
		setExtendedSearchFilter("");
		setDebouncedExtendedSearchFilter("");
		setLocationFilter("USA");
		setRadiusFilter("500");
		setStatusFilter("all");
		setStatusAutoAppliedByAddress(false);
		setCapabilitiesFilter([]);
		setDimensionsFilter(createEmptyDimensionsFilter());
		setDimensionsModalOpen(false);
		setCenterCoordinates(null);
		setRadiusMiles(null);
	}, [handleExtendedSearchToggle]);

	return (
		<div className="flex flex-col gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 md:gap-3 md:px-0 md:py-0">
			<PageBreadcrumb pageTitle="Drivers Map" />

			<div className="relative z-[1000]">
				<DriversMapFilters
					extendedSearchEnabled={extendedSearchEnabled}
					onExtendedSearchToggle={handleExtendedSearchToggle}
					addressFilter={addressFilter}
					setAddressFilter={setAddressFilter}
					extendedSearchFilter={extendedSearchFilter}
					setExtendedSearchFilter={setExtendedSearchFilter}
					capabilitiesFilter={capabilitiesFilter}
					setCapabilitiesFilter={setCapabilitiesFilter}
					dimensionsFilter={dimensionsFilter}
					setDimensionsFilter={setDimensionsFilter}
					dimensionsModalOpen={dimensionsModalOpen}
					setDimensionsModalOpen={setDimensionsModalOpen}
					locationFilter={locationFilter}
					setLocationFilter={setLocationFilter}
					radiusFilter={radiusFilter}
					setRadiusFilter={setRadiusFilter}
					statusFilter={statusFilter}
					onStatusFilterChange={value => {
						setStatusFilter(value);
						setStatusAutoAppliedByAddress(false);
					}}
					statusFilterOptions={statusFilterOptions}
					onFilterApply={handleFilterApply}
					onRadiusChange={handleRadiusChange}
					onClearFilter={handleClearFilter}
					onReset={handleReset}
				/>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] sm:rounded-2xl">
				<div className="h-[calc(100vh-260px)] min-h-[320px] sm:h-[calc(100vh-240px)] sm:min-h-[420px] md:h-[calc(100vh-220px)] md:min-h-[480px] lg:h-[calc(100vh-190px)] lg:min-h-[520px]">
					<DriversMapWithMarkers
						drivers={driversForMap}
						isLoading={isLoading}
						isFetching={isFetching}
						error={error}
						refetch={refetch}
						centerCoordinates={centerCoordinates}
						radiusMiles={radiusMiles}
						hideFilterBar
					/>
				</div>
			</div>
		</div>
	);
}
