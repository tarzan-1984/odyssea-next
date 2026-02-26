"use client";

import { useState, useRef, useEffect } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../../../ui/table";
import {
	Mc,
	TankerEndorsement,
	TwicIcon,
	HazmatIcon,
	Hazmat2Icon,
	Change9Icon,
	TeamIcon,
	CdlIcon,
	TsaIcon,
	BackgroundCheck,
	Liftgate,
	PalletJack,
	Dolly,
	Ppe,
	Etrack,
	Ramp,
	Printer,
	Sleeper,
	LoadBars,
	Dot,
	RealId,
	Military,
	DockHigh,
	Any,
	Otr,
	Local,
	Regional,
	Canada,
	Mexico,
} from "@/icons";
import PaginationWithIcon from "./PaginationWithIcon";
import Image from "next/image";
import macroPointIcon from "@/icons/additional/macropoint.png";
import tuckerTools from "@/icons/additional/tucker-tools.png";
import AlaskaIcon from "@/icons/additional/usa-alaska.svg";
import SideDoorIcon from "@/icons/additional/side_door.svg";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import MultiSelect from "@/components/form/MultiSelect";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import { useCurrentUser } from "@/stores/userStore";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import CreateOfferModal from "./CreateOfferModal";
import DriverNotesModal from "./DriverNotesModal";
import { driversListQueryOptions, type DriversListQueryParams } from "./driversListQueryOptions";

// Same status colors as on Drivers Map markers
const STATUS_COLORS: Record<string, string> = {
	available: "#8fbf8f",
	available_on: "#dcecdc",
	loaded_enroute: "#dcecdc",
	available_off: "#d4a5a5",
	banned: "#ffb261",
	no_interview: "#d60000",
	expired_documents: "#d60000",
	blocked: "#d60000",
	on_vocation: "#e0b0c4",
	on_hold: "#b2b2b2",
	need_update: "#f1cfcf",
	no_updates: "#ff3939",
	unknown: "#808080",
};

// Human-readable labels for status (underscore format -> display text)
const STATUS_LABELS: Record<string, string> = {
	available: "Available",
	available_on: "Available on",
	available_off: "Not available",
	loaded_enroute: "Loaded & Enroute",
	banned: "Out of service",
	on_vocation: "On vacation",
	no_updates: "No updates",
	blocked: "Blocked",
	expired_documents: "Expired documents",
	no_interview: "No Interview",
	no_Interview: "No Interview",
	on_hold: "On hold",
	need_update: "Need update",
	unknown: "Unknown",
};

function getStatusColor(status: string | null | undefined): string {
	if (!status) return STATUS_COLORS.unknown;
	return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.unknown;
}

function getStatusLabel(status: string | null | undefined): string {
	if (!status) return STATUS_LABELS.unknown;
	const key = status.toString();
	return STATUS_LABELS[key] ?? STATUS_LABELS[key.toLowerCase()] ?? status;
}

/** Format date as mm/dd/YY for Location & Date column */
function formatDateMmDdYy(date: Date | null): string {
	if (!date || Number.isNaN(date.getTime())) return "";
	const m = (date.getMonth() + 1).toString().padStart(2, "0");
	const d = date.getDate().toString().padStart(2, "0");
	const y = date.getFullYear().toString().slice(-2);
	return `${m}/${d}/${y}`;
}

export interface DriversListTableProps {
	/** When false, hides the "Actions" dropdown and Apply button (e.g. in Add drivers modal). Default true. */
	showActionsInHeader?: boolean;
	/** Optional footer button (e.g. "Add drivers" in modal). When set, shown in the footer. onClick receives selected driver IDs. */
	footerButton?: {
		label: string;
		onClick: (selectedDriverIds: string[]) => void | Promise<void>;
		icon?: React.ReactNode;
		isLoading?: boolean;
	} | null;
	/** Driver IDs that are already in the offer (e.g. when adding drivers to offer). These rows are disabled and styled as already added. */
	existingDriverIds?: string[];
}

export default function DriversListTable({
	showActionsInHeader = true,
	footerButton = null,
	existingDriverIds = [],
}: DriversListTableProps = {}) {
	const existingDriverIdsSet = new Set(existingDriverIds.map(id => String(id)));
	const currentUser = useCurrentUser();

	// State for pagination
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);

	// Create offer modal (only used when showActionsInHeader)
	const [createOfferModalOpen, setCreateOfferModalOpen] = useState(false);

	// Driver notes modal (driver id, name, notes count when open)
	const [notesModalDriver, setNotesModalDriver] = useState<{
		driverId: string;
		name: string;
		notesCount: number;
	} | null>(null);

	// Local filters
	const [addressFilter, setAddressFilter] = useState<string>("");
	const [debouncedAddressFilter, setDebouncedAddressFilter] = useState<string>("");
	const [locationFilter, setLocationFilter] = useState<"USA" | "Canada">("USA");

	// Debounce address filter (1.5 second delay)
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedAddressFilter(addressFilter);
		}, 1500);
		return () => clearTimeout(timer);
	}, [addressFilter]);
	const [radiusFilter, setRadiusFilter] = useState<string>("500");
	const [statusFilter, setStatusFilter] = useState<string>("");
	const [capabilitiesFilter, setCapabilitiesFilter] = useState<string[]>([]);
	const [hoveredStatusRowIndex, setHoveredStatusRowIndex] = useState<number | null>(null);
	const dragSelectRef = useRef({
		isActive: false,
		startIndex: -1,
		hasAddedAny: false,
	});

	const toggleDriverSelection = (driverId: string) => {
		setSelectedDriverIds(prev =>
			prev.includes(driverId) ? prev.filter(id => id !== driverId) : [...prev, driverId]
		);
	};

	const isAdmin = currentUser?.role?.toLowerCase() === "administrator";
	const requiresAddressToSearch = !isAdmin;
	const queryEnabled = isAdmin || Boolean(debouncedAddressFilter?.trim());
	const showTablePlaceholder = requiresAddressToSearch && !debouncedAddressFilter?.trim();

	const queryParams: DriversListQueryParams = {
		currentPage,
		itemsPerPage,
		capabilitiesFilter,
		addressFilter: debouncedAddressFilter,
		radiusFilter,
		locationFilter,
		statusFilter,
		role: currentUser?.role?.toLowerCase() ?? "",
	};

	const {
		data: driverList,
		isPending,
		isFetching,
		error,
		isPlaceholderData,
	} = useQuery({
		...driversListQueryOptions(queryParams),
		placeholderData: keepPreviousData,
		enabled: queryEnabled,
	});

	console.log('driverList', driverList);

	const filteredResults =
		(driverList?.data?.results as any[] | undefined)?.filter((item: any) => {
			if (!statusFilter) return true;
			const status = item?.meta_data?.driver_status as string | null | undefined;
			const statusLabel = getStatusLabel(status);
			return statusLabel === statusFilter;
		}) ?? [];

	const visibleDriverIds: string[] = filteredResults.map((d: any) => String(d.id));
	const selectableVisibleDriverIds = visibleDriverIds.filter(id => !existingDriverIdsSet.has(id));
	const allVisibleSelected =
		selectableVisibleDriverIds.length > 0 &&
		selectableVisibleDriverIds.every(id => selectedDriverIds.includes(id));

	const toggleAllVisible = () => {
		setSelectedDriverIds(prev => {
			if (allVisibleSelected) {
				return prev.filter(id => !selectableVisibleDriverIds.includes(id));
			}
			const next = new Set(prev);
			selectableVisibleDriverIds.forEach(id => next.add(id));
			return Array.from(next);
		});
	};

	useEffect(() => {
		const handleMouseUp = () => {
			const { isActive, startIndex, hasAddedAny } = dragSelectRef.current;
			if (isActive && !hasAddedAny && startIndex >= 0) {
				const item = filteredResults[startIndex];
				if (item && !existingDriverIdsSet.has(String(item.id))) {
					const id = String(item.id);
					setSelectedDriverIds(prev =>
						prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
					);
				}
			}
			dragSelectRef.current = { isActive: false, startIndex: -1, hasAddedAny: false };
		};
		document.addEventListener("mouseup", handleMouseUp);
		return () => document.removeEventListener("mouseup", handleMouseUp);
	}, [filteredResults, existingDriverIdsSet]);

	// Calculate total pages for pagination
	const totalItems = driverList?.data?.pagination?.total_posts || 0;
	const totalPages = driverList?.data?.pagination?.total_pages || 0;

	const showDistanceColumn =
		Boolean(debouncedAddressFilter) && Boolean(driverList?.data?.has_distance_data);
	const idPosts = driverList?.data?.id_posts ?? {};
	const colCount = showDistanceColumn ? 10 : 9;

	/** Map driverId -> empty_miles (rounded) for selected drivers with distance data. Used when creating offers. */
	const driverEmptyMiles: Record<string, number> = {};
	for (const driverId of selectedDriverIds) {
		const item = filteredResults.find((d: any) => String(d.id) === driverId);
		if (item) {
			const key = item?.meta_data?.driver_id ?? String(item?.id ?? "");
			const dist = idPosts[key]?.distance;
			if (dist != null) {
				const num = typeof dist === "string" ? parseFloat(dist) : Number(dist);
				if (Number.isFinite(num)) {
					driverEmptyMiles[driverId] = Math.round(num);
				}
			}
		}
	}

	return (
		<div className="relative min-w-0 bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header section — hidden for non-admin when Address is empty */}
			{!showTablePlaceholder && (
				<>
					<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						{/* Left: Items per page selector + Select all */}
						<div className="flex items-center gap-3">
							<span className="text-gray-500 dark:text-gray-400"> Show </span>

							<CustomStaticSelect
								options={[
									{ value: "5", label: "5" },
									{ value: "8", label: "8" },
									{ value: "10", label: "10" },
									{ value: "20", label: "20" },
									{ value: "50", label: "50" },
									{ value: "80", label: "80" },
									{ value: "100", label: "100" },
								]}
								value={itemsPerPage.toString()}
								onChangeAction={val => {
									setItemsPerPage(Number(val));
									setCurrentPage(1);
								}}
							/>
							<span className="text-gray-500 dark:text-gray-400"> entries </span>
							{showActionsInHeader && (
								<Button
									size="sm"
									variant="primary"
									disabled={selectableVisibleDriverIds.length === 0}
									onClick={toggleAllVisible}
									className="ml-2 h-9"
								>
									{allVisibleSelected ? "Deselect all" : "Select all"}
								</Button>
							)}
						</div>

						{/* Right side: Create Offers (main page) or Add drivers button (modal) */}
						<div className="flex min-w-0 items-center justify-end gap-3 sm:min-w-[140px]">
							{showActionsInHeader ? (
								<Button
									size="sm"
									variant="primary"
									disabled={
										selectedDriverIds.length === 0 || !showDistanceColumn
									}
									onClick={() => setCreateOfferModalOpen(true)}
									className="h-9"
								>
									Create Offers
								</Button>
							) : (
								footerButton && (
									<Button
										size="sm"
										variant="primary"
										disabled={
											selectedDriverIds.length === 0 || footerButton.isLoading
										}
										onClick={() => footerButton.onClick(selectedDriverIds)}
										className="inline-flex h-9 items-center gap-2"
									>
										{footerButton.label}
										{footerButton.icon}
									</Button>
								)
							)}
						</div>
					</div>

					{/* Create Offer modal (only on main drivers-list page) */}
					{showActionsInHeader && (
						<CreateOfferModal
							isOpen={createOfferModalOpen}
							onClose={() => setCreateOfferModalOpen(false)}
							externalId={currentUser?.externalId ?? ""}
							selectedDriverIds={selectedDriverIds}
							driverEmptyMiles={driverEmptyMiles}
							onSubmit={() => {
								setSelectedDriverIds([]);
							}}
						/>
					)}
				</>
			)}

			<div className="relative z-10 px-4 pb-4 border border-t-0 border-gray-100 dark:border-white/[0.05]">
				<div className="grid grid-cols-2 gap-2 sm:gap-3 md:flex md:flex-wrap md:items-end md:gap-3">
					{/* Capabilities (multiselect) */}
					<div className="flex min-w-0 flex-col md:min-w-[220px]">
						<MultiSelect
							label="Capabilities"
							options={[
								{
									value: "cdl",
									text: "CDL",
									selected: false,
									icon: <CdlIcon className="h-4 w-4" />,
								},
								{
									value: "hazmat",
									text: "Hazmat",
									selected: false,
									icon: <HazmatIcon className="h-4 w-4" />,
								},
								{
									value: "tsa",
									text: "TSA",
									selected: false,
									icon: <TsaIcon className="h-4 w-4" />,
								},
								{
									value: "twic",
									text: "TWIC",
									selected: false,
									icon: <TwicIcon className="h-4 w-4" />,
								},
								{
									value: "tanker-endorsement",
									text: "Tanker endorsement",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<TankerEndorsement className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "ppe",
									text: "PPE",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Ppe className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "dock-high",
									text: "Dock High",
									selected: false,
									icon: <DockHigh className="h-4 w-4" />,
								},
								{
									value: "e-track",
									text: "E-tracks",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Etrack className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "pallet-jack",
									text: "Pallet jack",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<PalletJack className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "ramp",
									text: "Ramp",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Ramp className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "load-bars",
									text: "Load bars",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<LoadBars className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "liftgate",
									text: "Liftgate",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Liftgate className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "team",
									text: "Team",
									selected: false,
									icon: <TeamIcon className="h-4 w-4" />,
								},
								{
									value: "canada",
									text: "Canada",
									selected: false,
									icon: <Canada className="h-4 w-4" />,
								},
								{
									value: "mexico",
									text: "Mexico",
									selected: false,
									icon: <Mexico className="h-4 w-4" />,
								},
								{
									value: "alaska",
									text: "Alaska",
									selected: false,
									icon: <AlaskaIcon className="h-4 w-4" />,
								},
								{
									value: "real_id",
									text: "Real ID",
									selected: false,
									icon: <RealId className="h-4 w-4" />,
								},
								{
									value: "macropoint",
									text: "MacroPoint",
									selected: false,
									icon: (
										<Image
											src={macroPointIcon}
											alt="MacroPoint"
											className="h-4 w-4"
										/>
									),
								},
								{
									value: "tucker-tools",
									text: "Trucker Tools",
									selected: false,
									icon: (
										<Image
											src={tuckerTools}
											alt="Trucker Tools"
											className="h-4 w-4"
										/>
									),
								},
								{
									value: "change-9",
									text: "Change 9",
									selected: false,
									icon: <Change9Icon className="h-4 w-4" />,
								},
								{
									value: "sleeper",
									text: "Sleeper",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Sleeper className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "printer",
									text: "Printer",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<Printer className="h-5 w-5" />
										</span>
									),
								},
								{
									value: "side_door",
									text: "Side door",
									selected: false,
									icon: (
										<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
											<SideDoorIcon className="h-5 w-5" />
										</span>
									),
								},
							]}
							defaultSelected={capabilitiesFilter}
							onChange={values => setCapabilitiesFilter(values)}
							triggerClassName="h-11"
						/>
					</div>

					<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Address */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-address-filter">Address</Label>
						<input
							id="drivers-list-address-filter"
							type="text"
							value={addressFilter}
							onChange={e => setAddressFilter(e.target.value)}
							placeholder="Enter address"
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-white/30 md:w-40"
						/>
					</div>

					<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Location */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-location-filter">Location</Label>
						<select
							id="drivers-list-location-filter"
							value={locationFilter}
							onChange={e =>
								setLocationFilter(e.target.value === "Canada" ? "Canada" : "USA")
							}
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[140px] md:w-auto"
						>
							<option value="USA">USA</option>
							<option value="Canada">Canada</option>
						</select>
					</div>

					<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Radius */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-radius-filter">Radius</Label>
						<select
							id="drivers-list-radius-filter"
							value={radiusFilter}
							onChange={e => setRadiusFilter(e.target.value)}
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[140px] md:w-auto"
						>
							<option value="50">50 miles</option>
							<option value="100">100 miles</option>
							<option value="150">150 miles</option>
							<option value="200">200 miles</option>
							<option value="250">250 miles</option>
							<option value="300">300 miles</option>
							<option value="400">400 miles</option>
							<option value="500">500 miles</option>
							<option value="600">600 miles</option>
							<option value="800">800 miles</option>
							<option value="1000">1000 miles</option>
						</select>
					</div>

					<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Status */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-status-filter">Status</Label>
						<select
							id="drivers-list-status-filter"
							value={statusFilter}
							onChange={e => setStatusFilter(e.target.value)}
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[160px] md:w-auto"
						>
							<option value="">All statuses</option>
							<option value="Available">Available</option>
							<option value="Available on">Available on</option>
							<option value="Not available">Not available</option>
							<option value="Loaded & Enroute">Loaded & Enroute</option>
							<option value="Out of service">Out of service</option>
							<option value="On vacation">On vacation</option>
							<option value="No updates">No updates</option>
							<option value="Blocked">Blocked</option>
						</select>
					</div>

					<div className="hidden self-end h-11 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Reset (сбрасывает только локальные фильтры на этой странице) */}
					<div className="col-span-2 flex min-w-0 flex-col md:col-span-1">
						<Label className="select-none text-transparent">{""}</Label>
						<button
							type="button"
							onClick={() => {
								setAddressFilter("");
								setDebouncedAddressFilter("");
								setLocationFilter("USA");
								setRadiusFilter("500");
								setStatusFilter("");
								setCapabilitiesFilter([]);
							}}
							className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:border-brand-800 md:w-auto"
						>
							Reset
						</button>
					</div>
				</div>
			</div>

			{showTablePlaceholder ? (
				<div className="flex min-h-[200px] items-center justify-center border border-t-0 rounded-b-xl border-gray-100 px-4 py-12 dark:border-white/[0.05]">
					<p className="text-center text-gray-500 dark:text-gray-400">
						Enter address to search for drivers
					</p>
				</div>
			) : (
				<>
					{/* Table section — min-w-0 so container can shrink; table width controlled by colgroup so no horizontal scrollbar */}
					<div className="min-w-0 overflow-x-hidden">
						<div
							className={`w-full min-w-0 transition-opacity ${
								isPlaceholderData ? "opacity-60" : "opacity-100"
							}`}
						>
							<Table className="w-full max-w-full table-fixed">
								{/* Order: Status, Location, Distance (only when Address filter), Driver, Vehicle, Dimensions, Equipment, Comments, Rating, Notes */}
								<colgroup>
									<col
										style={{
											width: "140px",
											minWidth: "140px",
											maxWidth: "140px",
										}}
									/>
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 26.25 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 14.25 / 87)",
										}}
									/>
									{showDistanceColumn && (
										<col
											style={{
												width: "68px",
												minWidth: "68px",
												maxWidth: "68px",
											}}
										/>
									)}
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 30 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 23 / 87)",
										}}
									/>
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 19 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 19 / 87)",
										}}
									/>
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 7.5 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 9.75 / 87)",
										}}
									/>
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 13 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 13 / 87)",
										}}
									/>
									<col
										style={{
											width: showDistanceColumn
												? "calc((100% - 140px - 68px - 72px - 72px) * 11.25 / 107)"
												: "calc((100% - 140px - 72px - 72px) * 8 / 87)",
										}}
									/>
									<col
										style={{
											width: "72px",
											minWidth: "72px",
											maxWidth: "72px",
										}}
									/>
									<col
										style={{
											width: "72px",
											minWidth: "72px",
											maxWidth: "72px",
										}}
									/>
								</colgroup>

								{/* Table header with sortable columns*/}
								<TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
									<TableRow>
										{[
											{ key: "status", label: "Status", sortable: true },
											{
												key: "location",
												label: "Location & Date",
												sortable: false,
											},
											...(showDistanceColumn
												? [
														{
															key: "distance",
															label: "Distance",
															sortable: false,
														},
													]
												: []),
											{ key: "driver", label: "Driver", sortable: false },
											{ key: "vehicle", label: "Vehicle", sortable: false },
											{
												key: "dimensions",
												label: "Dimensions",
												sortable: false,
											},
											{
												key: "equipment",
												label: "Equipment",
												sortable: false,
											},
											{ key: "comments", label: "Comments", sortable: false },
											{ key: "rating", label: "Rating", sortable: false },
											{ key: "notes", label: "Notes", sortable: false },
										].map(({ key, label, sortable }) => (
											<TableCell
												key={key}
												isHeader
												className={`py-3 border border-gray-100 dark:border-white/[0.05] ${
													key === "status"
														? "px-4 text-center align-middle"
														: key === "distance"
															? "px-2 text-right"
															: key === "rating" || key === "notes"
																? "px-2"
																: "px-4"
												}`}
												style={
													key === "distance"
														? { width: 68, minWidth: 68, maxWidth: 68 }
														: key === "rating" || key === "notes"
															? {
																	width: 72,
																	minWidth: 72,
																	maxWidth: 72,
																}
															: undefined
												}
											>
												<div className="flex items-center justify-between">
													<p className="font-medium text-gray-700 text-theme-xs dark:text-gray-400">
														{label}
													</p>
												</div>
											</TableCell>
										))}
									</TableRow>
								</TableHeader>

								{/* Table body with user data */}
								<TableBody>
									{isPending ? (
										<tr>
											<td colSpan={colCount} className="p-4" aria-hidden />
										</tr>
									) : (
										// Driver rows
										filteredResults.map((item: any, i: number) => {
											const preferred_distance =
												item?.meta_data?.preferred_distance;
											const selected_distances = preferred_distance
												.split(",")
												.map((item: string) => item.trim());

											const cross_border = item?.meta_data?.cross_border;
											const selected_cross_border = cross_border
												.split(",")
												.map((item: string) => item.trim());

											const legal_document_type =
												item?.meta_data?.legal_document_type;
											const legal_document_expiration =
												item?.meta_data?.legal_document_expiration;
											const legal_document_file =
												item?.meta_data?.legal_document;
											const background_check =
												item?.meta_data?.background_check;
											const background_file =
												item?.meta_data?.background_file;
											let legal_valid = false;
											const ny_timezone = "America/New_York";
											const now_ny = new Date(
												new Date().toLocaleString("en-US", {
													timeZone: ny_timezone,
												})
											);
											const now_ts = Math.floor(now_ny.getTime() / 1000);

											let background_valid = false;
											if (background_check && background_file) {
												background_valid = true;
											}

											if (
												legal_document_type === "us-passport" &&
												legal_document_file &&
												legal_document_expiration
											) {
												const $legal_exp_ts = Math.floor(
													new Date(legal_document_expiration).getTime() /
														1000
												);

												if (
													!Number.isNaN($legal_exp_ts) &&
													$legal_exp_ts >= now_ts
												) {
													legal_valid = true;
												}
											}

											const military_capability =
												legal_valid && background_valid;
											const isAlreadyInOffer = existingDriverIdsSet.has(
												String(item.id)
											);
											const isStatusHovered = hoveredStatusRowIndex === i;
											const isSelected = selectedDriverIds.includes(
												String(item.id)
											);
											const showHighlight = isSelected || isStatusHovered;

											return (
												<TableRow
													key={i + 1}
													className={`transition-none ${
														isAlreadyInOffer
															? "bg-gray-200/70 dark:bg-gray-700/50 opacity-90"
															: isSelected
																? "bg-gray-100 dark:bg-white/[0.08]"
																: isStatusHovered
																	? "bg-gray-50 dark:bg-white/[0.04]"
																	: ""
													}`}
												>
													{/*Status - first column, clickable to select driver*/}
													{(() => {
														const status = item?.meta_data
															?.driver_status as
															| string
															| null
															| undefined;
														const statusColor = getStatusColor(status);
														const statusLabel = getStatusLabel(status);
														return (
															<TableCell
																className={`relative px-4 py-3 font-normal text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap text-center align-middle select-none ${
																	isAlreadyInOffer
																		? "cursor-not-allowed"
																		: "cursor-pointer"
																}`}
																style={{
																	backgroundColor: statusColor,
																}}
																onMouseEnter={() => {
																	setHoveredStatusRowIndex(i);
																	if (
																		dragSelectRef.current
																			.isActive &&
																		!isAlreadyInOffer
																	) {
																		const {
																			startIndex,
																			hasAddedAny,
																		} = dragSelectRef.current;
																		dragSelectRef.current.hasAddedAny = true;
																		setSelectedDriverIds(
																			prev => {
																				const next =
																					new Set(prev);
																				if (
																					!hasAddedAny &&
																					startIndex >= 0
																				) {
																					const startItem =
																						filteredResults[
																							startIndex
																						];
																					if (
																						startItem &&
																						!existingDriverIdsSet.has(
																							String(
																								startItem.id
																							)
																						)
																					) {
																						next.add(
																							String(
																								startItem.id
																							)
																						);
																					}
																				}
																				next.add(
																					String(item.id)
																				);
																				return Array.from(
																					next
																				);
																			}
																		);
																	}
																}}
																onMouseLeave={() =>
																	setHoveredStatusRowIndex(null)
																}
																onMouseDown={() => {
																	if (!isAlreadyInOffer) {
																		dragSelectRef.current = {
																			isActive: true,
																			startIndex: i,
																			hasAddedAny: false,
																		};
																	}
																}}
															>
																{showHighlight && (
																	<div
																		className="absolute left-0 top-0 bottom-0 w-1 bg-blue-800 dark:bg-blue-600"
																		aria-hidden
																	/>
																)}
																{statusLabel}
															</TableCell>
														);
													})()}

													{/*location & date — light red background if datetime on second line is older than 12 hours */}
													{(() => {
														const dateStr =
															item?.updated_zipcode ||
															(item as any)?.date_updated ||
															item?.meta_data?.status_date ||
															"";
														const locationDate = dateStr
															? new Date(dateStr.replace(/\s+/, "T"))
															: null;
														const isOlderThan12h =
															locationDate &&
															!Number.isNaN(locationDate.getTime()) &&
															Date.now() - locationDate.getTime() >
																12 * 60 * 60 * 1000;
														const dateDisplay = locationDate
															? formatDateMmDdYy(locationDate)
															: dateStr || "";
														return (
															<TableCell
																className={`px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap ${isOlderThan12h ? "bg-red-50 dark:bg-red-950/30" : ""}`}
															>
																<p>
																	{item?.meta_data?.current_city}{" "}
																	{
																		item?.meta_data
																			?.current_location
																	}
																</p>
																<p>{dateDisplay}</p>
															</TableCell>
														);
													})()}

													{/*Distance - only when Address filter is filled and API returns id_posts*/}
													{showDistanceColumn && (
														<TableCell
															className="px-2 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap text-right"
															style={{
																width: 68,
																minWidth: 68,
																maxWidth: 68,
															}}
														>
															{(() => {
																const key =
																	item?.meta_data?.driver_id ??
																	String(item?.id ?? "");
																const dist = idPosts[key]?.distance;
																if (dist == null) return "—";
																const num =
																	typeof dist === "string"
																		? parseFloat(dist)
																		: Number(dist);
																return Number.isFinite(num)
																	? String(Math.round(num))
																	: "—";
															})()}
														</TableCell>
													)}

													{/*Driver*/}
													<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm break-words">
														<div className="space-y-0.5 break-words">
															<p
																className="break-words"
																title={`(${item?.id}) ${item?.meta_data?.driver_name || ""}`}
															>
																({item?.id}){" "}
																{item?.meta_data?.driver_name}
															</p>
															<p
																className="break-words"
																title={
																	item?.meta_data?.driver_phone ||
																	""
																}
															>
																{item?.meta_data?.driver_phone}
															</p>
														</div>
													</TableCell>

													{/*Vehicle*/}
													<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm break-words">
														<p className="break-words">
															{item?.meta_data?.vehicle_type}
														</p>
														<p className="break-words">
															{item?.meta_data?.vehicle_make}{" "}
															{item?.meta_data?.vehicle_model}{" "}
															{item?.meta_data?.vehicle_year}
														</p>
													</TableCell>

													{/*Dimensions*/}
													<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
														<p>{item?.meta_data?.dimensions}</p>
														<p>{item?.meta_data?.payload} lbs</p>
													</TableCell>

													{/*Equipment*/}
													<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap grid grid-cols-3 fullhd:grid-cols-4 gap-[10px]">
														{item?.meta_data?.twic === "on" && (
															<Tooltip
																theme="inverse"
																content="TWIC"
																position="top"
															>
																<span className="inline-flex">
																	<TwicIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.hazmat_certificate ===
															"on" && (
															<Tooltip
																theme="inverse"
																content="Hazmat Certificate"
																position="top"
															>
																<span className="inline-flex">
																	<HazmatIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.team_driver_enabled ===
															"on" && (
															<Tooltip
																theme="inverse"
																content="Team Driver"
																position="top"
															>
																<span className="inline-flex">
																	<TeamIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.driver_licence_type ===
															"cdl" && (
															<Tooltip
																theme="inverse"
																content="CDL"
																position="top"
															>
																<span className="inline-flex">
																	<CdlIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.driver_licence_type ===
															"tsa_approved" && (
															<Tooltip
																theme="inverse"
																content="TSA"
																position="top"
															>
																<span className="inline-flex">
																	<TsaIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.hazmat_endorsement ===
															"on" && (
															<Tooltip
																theme="inverse"
																content="Hazmat Endorsement"
																position="top"
															>
																<span className="inline-flex">
																	<Hazmat2Icon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.change_9_training ===
															"on" && (
															<Tooltip
																theme="inverse"
																content="Change 9"
																position="top"
															>
																<span className="inline-flex">
																	<Change9Icon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.tanker_endorsement ===
															"on" && (
															<Tooltip
																theme="inverse"
																content="Tanker endorsement"
																position="top"
															>
																<span className="inline-flex">
																	<TankerEndorsement className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.background_check ===
															"on" && (
															<Tooltip
																content="Background Check"
																position="top"
															>
																<span className="inline-flex">
																	<BackgroundCheck className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.lift_gate === "on" && (
															<Tooltip
																content="Liftgate"
																position="top"
															>
																<span className="inline-flex">
																	<Liftgate className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.pallet_jack === "on" && (
															<Tooltip
																content="Pallet jack"
																position="top"
															>
																<span className="inline-flex">
																	<PalletJack className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.dolly === "on" && (
															<Tooltip
																theme="inverse"
																content="Dolly"
																position="top"
															>
																<span className="inline-flex">
																	<Dolly className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.ppe === "on" && (
															<Tooltip
																theme="inverse"
																content="PPE"
																position="top"
															>
																<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
																	<Ppe className="h-5 w-5" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.e_tracks === "on" && (
															<Tooltip
																theme="inverse"
																content="E-tracks"
																position="top"
															>
																<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
																	<Etrack className="h-5 w-5" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.ramp === "on" && (
															<Tooltip content="Ramp" position="top">
																<span className="inline-flex">
																	<Ramp className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.printer === "on" && (
															<Tooltip
																content="Printer"
																position="top"
															>
																<span className="inline-flex">
																	<Printer className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.sleeper === "on" && (
															<Tooltip
																content="Sleeper"
																position="top"
															>
																<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
																	<Sleeper className="h-5 w-5" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.load_bars === "on" && (
															<Tooltip
																content="Load bars"
																position="top"
															>
																<span className="inline-flex">
																	<LoadBars className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.mc_enabled === "on" && (
															<Tooltip content="MC" position="top">
																<span className="inline-flex">
																	<Mc className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.dot_enabled === "on" && (
															<Tooltip content="DOT" position="top">
																<span className="inline-flex">
																	<Dot className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.real_id === "on" && (
															<Tooltip
																content="Real ID"
																position="top"
															>
																<span className="inline-flex">
																	<RealId className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{military_capability && (
															<Tooltip
																content="Military"
																position="top"
															>
																<span className="inline-flex">
																	<Military className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.macro_point === "on" && (
															<Tooltip
																content="MacroPoint"
																position="top"
															>
																<span className="inline-flex">
																	<Image
																		src={macroPointIcon}
																		alt="MacroPoint"
																		className="h-7 w-7"
																	/>
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.trucker_tools ===
															"on" && (
															<Tooltip
																content="Trucker Tools"
																position="top"
															>
																<span className="inline-flex">
																	<Image
																		src={tuckerTools}
																		alt="Trucker Tools"
																		className="h-7 w-7"
																	/>
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.dock_high === "on" && (
															<Tooltip
																content="Dock High"
																position="top"
															>
																<span className="inline-flex">
																	<DockHigh className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{selected_distances.includes("any") && (
															<Tooltip content="Any" position="top">
																<span className="inline-flex">
																	<Any className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{selected_distances.includes("otr") && (
															<Tooltip content="OTR" position="top">
																<span className="inline-flex">
																	<Otr className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{selected_distances.includes("local") && (
															<Tooltip content="Local" position="top">
																<span className="inline-flex">
																	<Local className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{selected_distances.includes(
															"regional"
														) && (
															<Tooltip
																content="Regional"
																position="top"
															>
																<span className="inline-flex">
																	<Regional className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{(item?.meta_data
															?.canada_transition_proof === "on" ||
															selected_cross_border.includes(
																"canada"
															)) && (
															<Tooltip
																content="Canada"
																position="top"
															>
																<span className="inline-flex">
																	<Canada className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{selected_cross_border.includes(
															"mexico"
														) && (
															<Tooltip
																content="Mexico"
																position="top"
															>
																<span className="inline-flex">
																	<Mexico className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.alaska === "on" && (
															<Tooltip
																content="Alaska"
																position="top"
															>
																<span className="inline-flex">
																	<AlaskaIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
														{item?.meta_data?.side_door === "on" && (
															<Tooltip
																content="Side door"
																position="top"
															>
																<span className="inline-flex">
																	<SideDoorIcon className="h-7 w-7" />
																</span>
															</Tooltip>
														)}
													</TableCell>

													{/* Comments */}
													<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm break-words">
														{item?.meta_data?.notes != null &&
														String(item.meta_data.notes).trim() !== ""
															? String(item.meta_data.notes)
															: "—"}
													</TableCell>

													{/* Rating */}
													<TableCell
														className="px-2 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap"
														style={{
															width: 72,
															minWidth: 72,
															maxWidth: 72,
														}}
													>
														{item?.rating?.avg_rating != null &&
														item.rating.avg_rating > 0
															? item.rating.avg_rating
															: "—"}
													</TableCell>

													{/* Notes */}
													<TableCell
														className="px-2 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap"
														style={{
															width: 72,
															minWidth: 72,
															maxWidth: 72,
														}}
													>
														<button
															type="button"
															onClick={() =>
																setNotesModalDriver({
																	driverId:
																		String(
																			item?.meta_data?.driver_id ??
																				item?.id ??
																				""
																		),
																	name:
																		item?.meta_data?.driver_name ??
																		"Driver",
																	notesCount: item?.notes?.count ?? 0,
																})
															}
															className="inline-flex min-w-[3.5rem] max-w-full items-center justify-center rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
														>
															{item?.notes?.count ?? 0}
														</button>
													</TableCell>
												</TableRow>
											);
										})
									)}
								</TableBody>
							</Table>
						</div>
					</div>

					{/* Footer section with pagination info and controls */}
					<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
						<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
							{/*Pagination info*/}
							<div className="pb-3 xl:pb-0">
								<p className="pb-3 text-sm font-medium text-center text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
									{totalItems === 0
										? "Showing 0 entries"
										: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
												currentPage * itemsPerPage,
												totalItems
											)} of ${totalItems} entries`}
								</p>
							</div>

							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
								{/*Pagination controls*/}
								{totalPages > 1 && (
									<PaginationWithIcon
										totalPages={totalPages}
										initialPage={currentPage}
										onPageChange={(page: number) => {
											setCurrentPage(page);
										}}
									/>
								)}
								{footerButton && (
									<Button
										size="sm"
										variant="primary"
										disabled={
											selectedDriverIds.length === 0 || footerButton.isLoading
										}
										onClick={() => footerButton.onClick(selectedDriverIds)}
										className="inline-flex items-center gap-2"
									>
										{footerButton.label}
										{footerButton.icon}
									</Button>
								)}
							</div>
						</div>
					</div>
				</>
			)}
			{queryEnabled && (isPending || isFetching) && (
				<div
					className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-white/10 rounded-b-xl"
					aria-hidden
				>
					<SpinnerOne />
				</div>
			)}

			{notesModalDriver && (
				<DriverNotesModal
					isOpen
					onClose={() => setNotesModalDriver(null)}
					driverId={notesModalDriver.driverId}
					driverName={notesModalDriver.name}
					notesCount={notesModalDriver.notesCount}
				/>
			)}
		</div>
	);
}
