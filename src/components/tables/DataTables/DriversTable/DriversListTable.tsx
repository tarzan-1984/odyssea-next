"use client";

import { useState } from "react";
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
	DockHigh, Any, Otr, Local, Regional, Canada, Mexico
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
import Select from "@/components/form/Select";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import axios from "axios";
import { Tooltip } from "@/components/ui/tooltip/Tooltip";
import { useCurrentUser } from "@/stores/userStore";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {DriversPage} from "./Types"
import CreateOfferModal from "./CreateOfferModal";

// Roles that can see drivers list without entering Address filter
const ROLES_CAN_SEE_DRIVERS_WITHOUT_ADDRESS = [
	"ADMINISTRATOR",
	"RECRUITER",
	"RECRUITER_TL",
	"HR_MANAGER",
	"DRIVER_UPDATES",
] as const;

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

function getStatusColor(status: string | null | undefined): string {
	if (!status) return STATUS_COLORS.unknown;
	return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.unknown;
}

export default function DriversListTable() {
	const currentUser = useCurrentUser();

	// State for pagination
	const [currentPage, setCurrentPage]             = useState(1);
	const [itemsPerPage, setItemsPerPage]           = useState(10);
	const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);

	// Actions: selected action and create-offer modal
	const [selectedAction, setSelectedAction]         = useState<string>("");
	const [createOfferModalOpen, setCreateOfferModalOpen] = useState(false);

	// Local filters (пока только в useState)
	const [addressFilter, setAddressFilter]           = useState<string>("");
	const [locationFilter, setLocationFilter]         = useState<"USA" | "Canada">("USA");
	const [radiusFilter, setRadiusFilter]             = useState<string>("500");
	const [capabilitiesFilter, setCapabilitiesFilter] = useState<string[]>([]);
	const toggleDriverSelection = (driverId: string) => {
		setSelectedDriverIds(prev =>
			prev.includes(driverId)
				? prev.filter(id => id !== driverId)
				: [...prev, driverId]
		);
	};

	const fetchDriversPage = async (
		page: number,
		per_page: number,
		capabilities: string[],
		address: string,
		radius: string,
		country: string
	): Promise<DriversPage> => {
		const params = new URLSearchParams();
		params.set("paged", String(page));
		params.set("per_page_loads", String(per_page));

		if (capabilities.length) {
			params.set("capabilities", capabilities.join(","));
		}

		if (address && radius && country) {
			params.set("my_search", address);
			params.set("radius", radius);
			params.set("country", country);
		}

		try {
			const { data } = await axios.get<DriversPage>(
				`/api/users/drivers/search?${params.toString()}`,
				{
					withCredentials: true,
				}
			);

			return data;
		} catch (error: any) {
			const message =
				error?.response?.data?.error ||
				error?.message ||
				"Failed to fetch drivers";
			throw new Error(message);
		}
	};

	// Show drivers without address only for specific roles; others must enter Address
	const canShowDriversWithoutAddress =
		!!currentUser?.role &&
		ROLES_CAN_SEE_DRIVERS_WITHOUT_ADDRESS.includes(
			currentUser.role as (typeof ROLES_CAN_SEE_DRIVERS_WITHOUT_ADDRESS)[number]
		);
	const isAddressEmpty = addressFilter.trim() === "";
	const isQueryEnabled = !isAddressEmpty || canShowDriversWithoutAddress;

	// Fetch users data when dependencies change
	const {
		data: driverList,
		isPending,
		error,
		isPlaceholderData,
	} = useQuery({
		queryKey: [
			"drivers-list",
			{ currentPage, itemsPerPage, capabilitiesFilter, addressFilter, radiusFilter, locationFilter },
		],
		queryFn: () => fetchDriversPage(currentPage, itemsPerPage, capabilitiesFilter, addressFilter, radiusFilter, locationFilter),
		staleTime: 10 * 60 * 1000,
		placeholderData: keepPreviousData,
		enabled: isQueryEnabled,
	});

	const visibleDriverIds: string[] = driverList?.data?.results?.map((d: any) => d.id) ?? [];
	const allVisibleSelected =
		visibleDriverIds.length > 0 &&
		visibleDriverIds.every(id => selectedDriverIds.includes(id));

	const toggleAllVisible = () => {
		setSelectedDriverIds(prev => {
			if (allVisibleSelected) {
				// Unselect all visible
				return prev.filter(id => !visibleDriverIds.includes(id));
			}
			// Select all visible (merge with previous)
			const set = new Set(prev);
			visibleDriverIds.forEach(id => set.add(id));
			return Array.from(set);
		});
	};

	// Calculate total pages for pagination
	const totalItems = driverList?.data?.pagination?.total_posts || 0;
	const totalPages = driverList?.data?.pagination?.total_pages || 0;

	return (
		<div className="bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header section with pagination controls and search */}
			<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
				{/* Items per page selector */}
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
				</div>

				{/* Actions select */}
				{/*<div className="flex min-w-0 items-center justify-end gap-3 sm:min-w-[260px]">
					<Label className="mb-0">Actions</Label>
					<Select
						options={[{ value: "create-offers", label: "Create Offers" }]}
						placeholder="Choise Action"
						onChange={(value) => setSelectedAction(value)}
						defaultValue=""
						className="dark:bg-gray-900"
					/>
					<Button
						size="sm"
						variant="primary"
						disabled={selectedDriverIds.length === 0 || !selectedAction}
						onClick={() => {
							if (selectedAction === "create-offers") {
								setCreateOfferModalOpen(true);
							}
						}}
					>
						Apply
					</Button>
				</div>*/}
			</div>

			{/* Create Offer modal */}
			<CreateOfferModal
				isOpen={createOfferModalOpen}
				onClose={() => setCreateOfferModalOpen(false)}
				externalId={currentUser?.externalId ?? ""}
				selectedDriverIds={selectedDriverIds}
				onSubmit={(values) => {
					// TODO: send to API
					console.log("Create offer form submitted:", values);
				}}
			/>

			<div className="relative z-0 px-4 pb-4 border border-t-0 border-gray-100 dark:border-white/[0.05]">
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
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<TankerEndorsement className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "ppe",
									text: "PPE",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Ppe className="h-3 w-3" />
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
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Etrack className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "pallet-jack",
									text: "Pallet jack",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<PalletJack className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "ramp",
									text: "Ramp",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Ramp className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "load-bars",
									text: "Load bars",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<LoadBars className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "liftgate",
									text: "Liftgate",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Liftgate className="h-3 w-3" />
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
									icon: <Image src={macroPointIcon} alt="MacroPoint" className="h-4 w-4" />,
								},
								{
									value: "tucker-tools",
									text: "Trucker Tools",
									selected: false,
									icon: <Image src={tuckerTools} alt="Trucker Tools" className="h-4 w-4" />,
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
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Sleeper className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "printer",
									text: "Printer",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<Printer className="h-3 w-3" />
										</span>
									),
								},
								{
									value: "side_door",
									text: "Side door",
									selected: false,
									icon: (
										<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
											<SideDoorIcon className="h-3 w-3" />
										</span>
									),
								},
							]}
							defaultSelected={capabilitiesFilter}
							onChange={(values) => setCapabilitiesFilter(values)}
							triggerClassName="h-11"
						/>
					</div>

					<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Address */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-address-filter">Address</Label>
						<input
							id="drivers-list-address-filter"
							type="text"
							value={addressFilter}
							onChange={(e) => setAddressFilter(e.target.value)}
							placeholder="Enter address"
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-white/30 md:w-40"
						/>
					</div>

					<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Location */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-location-filter">Location</Label>
						<select
							id="drivers-list-location-filter"
							value={locationFilter}
							onChange={(e) =>
								setLocationFilter(e.target.value === "Canada" ? "Canada" : "USA")
							}
							className="h-11 w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-brand-800 md:min-w-[140px] md:w-auto"
						>
							<option value="USA">USA</option>
							<option value="Canada">Canada</option>
						</select>
					</div>

					<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Radius */}
					<div className="flex min-w-0 flex-col">
						<Label htmlFor="drivers-list-radius-filter">Radius</Label>
						<select
							id="drivers-list-radius-filter"
							value={radiusFilter}
							onChange={(e) => setRadiusFilter(e.target.value)}
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

					<div className="hidden h-8 w-px bg-gray-300 dark:bg-gray-600 md:block" />

					{/* Reset (сбрасывает только локальные фильтры на этой странице) */}
					<div className="col-span-2 flex min-w-0 flex-col md:col-span-1">
						<Label className="select-none text-transparent">{""}</Label>
						<button
							type="button"
							onClick={() => {
								setAddressFilter("");
								setLocationFilter("USA");
								setRadiusFilter("500");
								setCapabilitiesFilter([]);
							}}
							className="h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:border-brand-800 md:w-auto"
						>
							Reset
						</button>
					</div>
				</div>
			</div>

			{/* Table section */}
			<div className="overflow-x-auto custom-scrollbar border-l border-gray-100 dark:border-white/[0.05]">
				<div
					className={`min-w-max transition-opacity ${
						isPlaceholderData ? "opacity-60" : "opacity-100"
					}`}
				>
					<Table>
						<colgroup>
							<col className="w-12" />
							<col style={{ width: "120px" }} />
							<col />
							<col />
							<col />
							<col />
							<col />
						</colgroup>
						{/* Table header with sortable columns*/}
						<TableHeader className="border-t border-gray-100 dark:border-white/[0.05]">
							<TableRow>
								<TableCell
									isHeader
									className="w-12 min-w-12 px-4 py-3 border border-gray-100 dark:border-white/[0.05] text-center align-middle"
								>
									<div className="inline-flex items-center justify-center">
										<input
											type="checkbox"
											className="h-4 w-4 cursor-pointer"
											checked={allVisibleSelected}
											onChange={toggleAllVisible}
										/>
									</div>
								</TableCell>
								{[
									{ key: "status", label: "Status", sortable: true },
									{ key: "location", label: "Location & Date", sortable: false },
									{ key: "driver", label: "Driver", sortable: false },
									{ key: "vehicle", label: "Vehicle", sortable: false },
									{ key: "dimensions", label: "Dimensions", sortable: false },
									{ key: "equipment", label: "Equipment", sortable: false },
								].map(({ key, label, sortable }) => (
									<TableCell
										key={key}
										isHeader
										className={`px-4 py-3 border border-gray-100 dark:border-white/[0.05] ${
											key === "status" ? "text-center align-middle" : ""
										} ${key === "driver" ? "w-[260px] min-w-[260px] max-w-[300px] fullhd:w-auto fullhd:min-w-0 fullhd:max-w-none" : ""
										} ${key === "vehicle" ? "w-[200px] min-w-[180px] max-w-[240px] fullhd:w-auto fullhd:min-w-0 fullhd:max-w-none" : ""}`}
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
							{!isQueryEnabled ? (
								// Address required for current role
								<tr>
									<td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
										Enter address to view drivers.
									</td>
								</tr>
							) : isPending ? (
								// Loading spinner
								<tr>
									<td colSpan={7} className="p-2">
										<SpinnerOne />
									</td>
								</tr>
							) : (
								// Driver rows
								driverList?.data?.results?.map((item, i) => {
									const preferred_distance = item?.meta_data?.preferred_distance;
									const selected_distances = preferred_distance
										.split(',')
										.map(item => item.trim());

									const cross_border = item?.meta_data?.cross_border;
									const selected_cross_border = cross_border
										.split(',')
										.map(item => item.trim());


									const legal_document_type      = item?.meta_data?.legal_document_type;
									const legal_document_expiration= item?.meta_data?.legal_document_expiration;
									const legal_document_file      = item?.meta_data?.legal_document;
									const background_check         = item?.meta_data?.background_check;
									const background_file = item?.meta_data?.background_file;
									let legal_valid = false;
									const ny_timezone = 'America/New_York';
									const now_ny = new Date(
										new Date().toLocaleString('en-US', { timeZone: ny_timezone })
									);
									const now_ts = Math.floor(now_ny.getTime() / 1000);

									let background_valid = false;
									if ( background_check && background_file ) {
										background_valid = true;
									}

									if (
										legal_document_type === 'us-passport' &&
										legal_document_file &&
										legal_document_expiration
									) {
										const $legal_exp_ts = Math.floor(
											new Date(legal_document_expiration).getTime() / 1000
										);

										if (!Number.isNaN($legal_exp_ts) && $legal_exp_ts >= now_ts) {
											legal_valid = true;
										}
									}

									const military_capability = legal_valid && background_valid;

									return (
										<TableRow key={i + 1}>
											<TableCell className="w-12 min-w-12 px-4 py-3 border border-gray-100 dark:border-white/[0.05] text-center align-middle">
												<div className="inline-flex items-center justify-center">
													<input
														type="checkbox"
														className="h-4 w-4 cursor-pointer"
														checked={selectedDriverIds.includes(item.id)}
														onChange={() => toggleDriverSelection(item.id)}
													/>
												</div>
											</TableCell>

											{/*Status*/}
											{(() => {
												const status = item?.meta_data?.driver_status as string | null | undefined;
												const statusColor = getStatusColor(status);
												return (
													<TableCell
														className="px-4 py-3 font-normal text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap text-center align-middle"
														style={{ backgroundColor: statusColor }}
													>
														{status}
													</TableCell>
												);
											})()}

											{/*location & date — light red background if datetime on second line is older than 12 hours */}
											{(() => {
												const dateStr = item?.updated_zipcode || (item as any)?.date_updated || item?.meta_data?.status_date || "";
												const locationDate = dateStr ? new Date(dateStr.replace(/\s+/, "T")) : null;
												const isOlderThan12h = locationDate && !Number.isNaN(locationDate.getTime()) && (Date.now() - locationDate.getTime() > 12 * 60 * 60 * 1000);
												return (
													<TableCell
														className={`px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap ${isOlderThan12h ? "bg-red-50 dark:bg-red-950/30" : ""}`}
													>
														<p>{item?.meta_data?.current_city} {item?.meta_data?.current_location}</p>
														<p>{item?.updated_zipcode}</p>
													</TableCell>
												);
											})()}

											{/*Driver*/}
											<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm w-[260px] min-w-[260px] max-w-[300px] fullhd:w-auto fullhd:min-w-0 fullhd:max-w-none">
												<div className="space-y-0.5 break-words">
													<p
														className="break-words"
														title={`(${item?.id}) ${item?.meta_data?.driver_name || ""}`}
													>
														({item?.id}) {item?.meta_data?.driver_name}
													</p>
													<p
														className="break-words"
														title={item?.meta_data?.driver_phone || ""}
													>
														{item?.meta_data?.driver_phone}
													</p>
												</div>
											</TableCell>

											{/*vehicle*/}
											{/*Vehicle*/}
											<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm w-[200px] min-w-[180px] max-w-[240px] fullhd:w-auto fullhd:min-w-0 fullhd:max-w-none break-words">
												<p className="break-words">{item?.meta_data?.vehicle_type}</p>
												<p className="break-words">{item?.meta_data?.vehicle_make} {item?.meta_data?.vehicle_model} {item?.meta_data?.vehicle_year}</p>
											</TableCell>

											{/*Dimensions*/}
											<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap">
												<p>{item?.meta_data?.dimensions}</p>
												<p>{item?.meta_data?.payload} - lbs</p>
											</TableCell>

											{/*Equipment*/}
											<TableCell className="px-4 py-3 font-normal dark:text-gray-400/90 text-gray-800 border border-gray-100 dark:border-white/[0.05] text-theme-sm whitespace-nowrap grid grid-cols-3 fullhd:grid-cols-4 gap-[10px]">
												{item?.meta_data?.twic === "on" && (
													<Tooltip theme="inverse" content="TWIC" position="top">
														<span className="inline-flex"><TwicIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.hazmat_certificate === "on" && (
													<Tooltip theme="inverse" content="Hazmat Certificate" position="top">
														<span className="inline-flex"><HazmatIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.team_driver_enabled === "on" && (
													<Tooltip theme="inverse" content="Team Driver" position="top">
														<span className="inline-flex"><TeamIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.driver_licence_type === "cdl" && (
													<Tooltip theme="inverse" content="CDL" position="top">
														<span className="inline-flex"><CdlIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.driver_licence_type === "tsa_approved" && (
													<Tooltip theme="inverse" content="TSA" position="top">
														<span className="inline-flex"><TsaIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.hazmat_endorsement === "on" && (
													<Tooltip theme="inverse" content="Hazmat Endorsement" position="top">
														<span className="inline-flex"><Hazmat2Icon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.change_9_training === "on" && (
													<Tooltip theme="inverse" content="Change 9" position="top">
														<span className="inline-flex"><Change9Icon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.tanker_endorsement === "on" && (
													<Tooltip theme="inverse" content="Tanker endorsement" position="top">
														<span className="inline-flex"><TankerEndorsement className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.background_check === "on" && (
													<Tooltip content="Background Check" position="top">
														<span className="inline-flex"><BackgroundCheck className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.lift_gate === "on" && (
													<Tooltip content="Liftgate" position="top">
														<span className="inline-flex"><Liftgate className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.pallet_jack === "on" && (
													<Tooltip content="Pallet jack" position="top">
														<span className="inline-flex"><PalletJack className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.dolly === "on" && (
													<Tooltip theme="inverse" content="Dolly" position="top">
														<span className="inline-flex"><Dolly className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.ppe === "on" && (
													<Tooltip theme="inverse" content="PPE" position="top">
														<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
															<Ppe className="h-3 w-3" />
														</span>
													</Tooltip>
												)}
												{item?.meta_data?.e_tracks === "on" && (
													<Tooltip theme="inverse" content="E-tracks" position="top">
														<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
															<Etrack className="h-3 w-3" />
														</span>
													</Tooltip>
												)}
												{item?.meta_data?.ramp === "on" && (
													<Tooltip content="Ramp" position="top">
														<span className="inline-flex"><Ramp className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.printer === "on" && (
													<Tooltip content="Printer" position="top">
														<span className="inline-flex"><Printer className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.sleeper === "on" && (
													<Tooltip content="Sleeper" position="top">
														<span className="inline-flex h-5 w-5 items-center justify-center rounded bg-white dark:bg-white">
															<Sleeper className="h-3 w-3" />
														</span>
													</Tooltip>
												)}
												{item?.meta_data?.load_bars === "on" && (
													<Tooltip content="Load bars" position="top">
														<span className="inline-flex"><LoadBars className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.mc_enabled === "on" && (
													<Tooltip content="MC" position="top">
														<span className="inline-flex"><Mc className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.dot_enabled === "on" && (
													<Tooltip content="DOT" position="top">
														<span className="inline-flex"><Dot className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.real_id === "on" && (
													<Tooltip content="Real ID" position="top">
														<span className="inline-flex"><RealId className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{military_capability && (
													<Tooltip content="Military" position="top">
														<span className="inline-flex"><Military className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.macro_point === "on" && (
													<Tooltip content="MacroPoint" position="top">
														<span className="inline-flex"><Image src={macroPointIcon} alt="MacroPoint" className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.trucker_tools === "on" && (
													<Tooltip content="Trucker Tools" position="top">
														<span className="inline-flex"><Image src={tuckerTools} alt="Trucker Tools" className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.dock_high === "on" && (
													<Tooltip content="Dock High" position="top">
														<span className="inline-flex"><DockHigh className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{selected_distances.includes('any') && (
													<Tooltip content="Any" position="top">
														<span className="inline-flex"><Any className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{selected_distances.includes('otr') && (
													<Tooltip content="OTR" position="top">
														<span className="inline-flex"><Otr className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{selected_distances.includes('local') && (
													<Tooltip content="Local" position="top">
														<span className="inline-flex"><Local className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{selected_distances.includes('regional') && (
													<Tooltip content="Regional" position="top">
														<span className="inline-flex"><Regional className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{(item?.meta_data?.canada_transition_proof === "on" || selected_cross_border.includes('canada')) && (
													<Tooltip content="Canada" position="top">
														<span className="inline-flex"><Canada className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{selected_cross_border.includes('mexico') && (
													<Tooltip content="Mexico" position="top">
														<span className="inline-flex"><Mexico className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.alaska === "on" && (
													<Tooltip content="Alaska" position="top">
														<span className="inline-flex"><AlaskaIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
												{item?.meta_data?.side_door === "on" && (
													<Tooltip content="Side door" position="top">
														<span className="inline-flex"><SideDoorIcon className="h-5 w-5" /></span>
													</Tooltip>
												)}
											</TableCell>

										</TableRow>
									)
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
							{(isQueryEnabled ? totalItems : 0) === 0
								? "Showing 0 entries"
								: `Showing ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} to ${Math.min(
										currentPage * itemsPerPage,
										totalItems
									)} of ${totalItems} entries`}
						</p>
					</div>

					 {/*Pagination controls*/}
					{isQueryEnabled && totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => {
								setCurrentPage(page);
							}}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
