"use client";

import { useState } from "react";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import { useCurrentUser } from "@/stores/userStore";
import { ChevronDownIcon, ChevronUpIcon } from "@/icons";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import offersApi, { formatRoute, routeSummary } from "@/app-api/offers";
import type { OfferRow } from "@/app-api/offers";
import AddDriversModal from "@/components/tables/DataTables/DriversTable/AddDriversModal";
import UserFilterSelect from "./UserFilterSelect";

/** Format date string (e.g. "02/16/2026, 05:26:26" or ISO) to mm/dd/YY */
function formatDateMmDdYy(dateStr: string | null | undefined): string {
	if (!dateStr) return "";
	const trimmed = dateStr.trim();
	const comma = trimmed.indexOf(", ");
	if (comma !== -1) {
		const datePart = trimmed.slice(0, comma);
		const [m, d, y] = datePart.split("/");
		if (m && d && y) {
			const yy = y.length >= 4 ? y.slice(-2) : y;
			return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${yy}`;
		}
	}
	const date = new Date(trimmed.replace(/\s+/, "T"));
	if (Number.isNaN(date.getTime())) return dateStr;
	const mm = (date.getMonth() + 1).toString().padStart(2, "0");
	const dd = date.getDate().toString().padStart(2, "0");
	const yy = date.getFullYear().toString().slice(-2);
	return `${mm}/${dd}/${yy}`;
}

function formatSpecialRequirements(value: unknown): string {
	if (value == null) return "";
	if (Array.isArray(value)) return value.map(String).join(", ");
	if (typeof value === "string") return value;
	return String(value);
}

const OffersList = () => {
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
	const [addDriversOfferId, setAddDriversOfferId] = useState<string | null>(null);
	const [addDriversExistingDriverIds, setAddDriversExistingDriverIds] = useState<string[]>([]);
	const [isAddingDrivers, setIsAddingDrivers] = useState(false);
	const [deletingDriverKey, setDeletingDriverKey] = useState<string | null>(null);
	const [deactivatingOfferId, setDeactivatingOfferId] = useState<string | null>(null);
	const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
	const [userFilterId, setUserFilterId] = useState("");

	const isAdmin = currentUser?.role === "ADMINISTRATOR";
	const queryParams = {
		page: currentPage,
		limit: itemsPerPage,
		sort_order: "action_time_asc" as const,
		status: statusFilter,
		...(isAdmin
			? userFilterId
				? { user_id: userFilterId }
				: {}
			: { user_id: currentUser?.externalId ?? "" }),
	};

	const {
		data,
		isPending,
		isPlaceholderData,
	} = useQuery({
		queryKey: ["offers-list-cards", queryParams],
		queryFn: () => offersApi.getOffers(queryParams),
		placeholderData: keepPreviousData,
	});

	const results: OfferRow[] = data?.data?.results ?? [];
	const pagination = data?.data?.pagination;
	const totalItems = pagination?.total_count ?? 0;
	const totalPages = pagination?.total_pages ?? 1;

	return (
		<div className="bg-white dark:bg-white/[0.03] rounded-xl">
			{/* Header: Show X entries */}
			<div className="relative z-20 flex flex-col gap-2 px-4 py-4 border border-b-0 border-gray-100 dark:border-white/[0.05] rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<span className="text-gray-500 dark:text-gray-400"> Show </span>
					<CustomStaticSelect
						options={[
							{ value: "5", label: "5" },
							{ value: "8", label: "8" },
							{ value: "10", label: "10" },
							{ value: "20", label: "20" },
							{ value: "50", label: "50" },
						]}
						value={itemsPerPage.toString()}
						onChangeAction={val => {
							setItemsPerPage(Number(val));
							setCurrentPage(1);
						}}
					/>
					<span className="text-gray-500 dark:text-gray-400"> entries </span>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					{isAdmin && (
						<>
							<span className="text-gray-500 dark:text-gray-400"> User </span>
							<UserFilterSelect
								value={userFilterId}
								onChangeAction={(val) => {
									setUserFilterId(val);
									setCurrentPage(1);
								}}
							/>
						</>
					)}
					<span className="text-gray-500 dark:text-gray-400"> Status </span>
					<CustomStaticSelect
						options={[
							{ value: "active", label: "Active" },
							{ value: "inactive", label: "Inactive" },
						]}
						value={statusFilter}
						onChangeAction={(val) => {
							setStatusFilter(val as "active" | "inactive");
							setCurrentPage(1);
						}}
					/>
				</div>
			</div>

			{/* Cards list */}
			<div className="border border-t-0 border-b-0 border-gray-100 dark:border-white/[0.05] px-4 py-4">
				{isPending ? (
					<div className="flex justify-center py-8">
						<SpinnerOne />
					</div>
				) : results.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12 gap-4">
						<img
							src="/images/no_offers_found.png"
							alt=""
							className="max-w-[200px] h-auto object-contain"
						/>
						<p className="text-sm text-gray-500 dark:text-gray-400">No offers found</p>
					</div>
				) : (
					<div className="space-y-3">
						{results.map((row) => {
							const isExpanded = expandedOfferId === row.id;
							return (
								<div
									key={row.id}
									className="relative w-full rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/[0.05] dark:bg-gray-900 overflow-hidden"
								>
									<div
										className={`px-4 py-3 flex items-center justify-between gap-3 ${
											row.active === false ? "bg-red-50 dark:bg-red-900/20" : ""
										}`}
									>
										<div className="flex flex-col gap-1 min-w-0">
											<p className="text-base font-medium text-gray-900 dark:text-white truncate">
												<span className="mr-3">{formatDateMmDdYy(row.create_time)}</span>
												{routeSummary(row.route) ||
													`${row.pick_up_location ?? ""} - ${row.delivery_location ?? ""}`}{" "}
												(id: {row.id})
											</p>
										</div>
										<div className="flex items-center justify-center flex-shrink-0">
											<button
												type="button"
												onClick={() =>
													setExpandedOfferId((id) => (id === row.id ? null : row.id))
												}
												className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:text-brand-200 dark:hover:bg-gray-800"
											>
												<span>{isExpanded ? "Show less" : "Show more"}</span>
												{isExpanded ? (
													<ChevronUpIcon className="h-4 w-4" />
												) : (
													<ChevronDownIcon className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
									{isExpanded && (
										<div className="border-t border-gray-100 dark:border-white/[0.05] px-4 py-3">
											<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
												Details
											</h3>
											<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/[0.08]">
												<Table className="border-collapse w-full">
													<TableHeader className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
														<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Route
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Weight
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Commodity
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Special Requirements
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Notes
															</TableCell>
														</TableRow>
													</TableHeader>
													<TableBody>
														<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-pre-line">
																{formatRoute(row.route) || "—"}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.weight != null ? `${Number(row.weight).toLocaleString("en-US")} lbs` : "—"}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.commodity ?? "—"}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{formatSpecialRequirements(row.special_requirements) || "—"}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.notes && String(row.notes).trim()
																	? String(row.notes).trim()
																	: "—"}
															</TableCell>
														</TableRow>
													</TableBody>
												</Table>
											</div>

											{/* Drivers table */}
											{row.drivers && row.drivers.length > 0 && (
												<div className="mt-4">
													<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
														Drivers
													</h3>
													<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-white/[0.08]">
													<Table className="border-collapse w-full table-fixed">
												<colgroup>
													<col style={{ width: "24%" }} />
													<col style={{ width: "15%" }} />
													<col style={{ width: "12%" }} />
													<col style={{ width: "11%" }} />
													<col style={{ width: "9%" }} />
													<col style={{ width: "9%" }} />
													<col style={{ width: "20%" }} />
												</colgroup>
														<TableHeader className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
															<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Unit
															</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Phone
																</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Empty miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Total miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Rate
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Bid timer
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/[0.08]">
																	Actions
																</TableCell>
															</TableRow>
														</TableHeader>
														<TableBody>
															{row.drivers.map((driver, driverIndex) => (
																<TableRow key={`${row.id}-${driver.driver_id ?? driver.externalId ?? driverIndex}`} className="border-gray-200 dark:border-white/[0.08]">
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																<span className="inline-flex items-center gap-1.5">
																	<span>
																		{driver.externalId != null ? `(${driver.externalId}) ` : ""}
																		{[driver.firstName, driver.lastName].filter(Boolean).join(" ") || "—"}
																	</span>
																	{driver.status?.toUpperCase() === "ACTIVE" ? (
																		<svg className="shrink-0 w-5 h-5" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 397 511.911"><path fill="#1A1A1A" d="M62.087 0h168.92c17.125 0 32.753 6.988 43.891 18.212 11.293 11.306 18.184 26.85 18.184 43.89v36.586c-2.371-.11-4.755-.173-7.154-.173-4.28 0-8.515.188-12.704.538V61.507H19.771v364.164h253.453v-26.146c4.189.35 8.424.537 12.704.537a154.3 154.3 0 007.154-.172v49.934c0 17.138-6.975 32.766-18.184 43.891-11.322 11.321-26.85 18.196-43.891 18.196H62.087c-17.138 0-32.765-6.972-43.89-18.196C6.89 482.421 0 466.878 0 449.824V62.018c0-17.14 6.975-32.767 18.197-43.905C29.49 6.819 44.949 0 62.087 0zm84.376 445.096c14.046 0 25.523 11.308 25.523 25.523 0 14.061-11.306 25.538-25.523 25.538-14.046 0-25.538-11.307-25.538-25.538 0-14.031 11.309-25.523 25.538-25.523z"/><path fill="#00A912" d="M285.928 138.216c61.364 0 111.072 49.739 111.072 111.072 0 61.364-49.74 111.072-111.072 111.072-61.364 0-111.073-49.74-111.073-111.072 0-61.366 49.74-111.072 111.073-111.072zm-35.903 94.85l19.688 18.593 49.388-50.017c3.857-3.916 6.274-7.055 11.025-2.161l15.426 15.803c5.068 5.01 4.809 7.945.032 12.608l-67.062 66.023c-10.075 9.875-8.32 10.48-18.538.347l-35.921-35.722c-2.132-2.304-1.902-4.634.428-6.937l17.907-18.569c2.713-2.856 4.874-2.607 7.627.032z"/></svg>
																	) : (
																		<svg className="shrink-0 w-5 h-5" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 397 511.546"><path d="M62.043 0h168.8c17.112 0 32.728 6.983 43.859 18.199 11.285 11.298 18.171 26.831 18.171 43.859v36.559a155.489 155.489 0 00-7.149-.172c-4.277 0-8.509.188-12.695.537V61.463H19.757v363.905h253.272V399.24c4.186.349 8.418.537 12.695.537 2.397 0 4.78-.063 7.149-.173v49.9c0 17.125-6.97 32.741-18.171 43.858-11.314 11.314-26.831 18.184-43.859 18.184h-168.8c-17.126 0-32.742-6.967-43.859-18.184C6.885 482.077 0 466.545 0 449.504V61.974C0 44.846 6.97 29.23 18.184 18.1 29.469 6.814 44.917 0 62.043 0zm84.316 444.778c14.036 0 25.505 11.301 25.505 25.505 0 14.051-11.299 25.52-25.505 25.52-14.036 0-25.52-11.298-25.52-25.52 0-14.021 11.3-25.505 25.52-25.505z"/><path fill="#F44336" d="M285.724 137.837c61.478 0 111.276 49.83 111.276 111.276 0 61.476-49.83 111.276-111.276 111.276-61.476 0-111.274-49.832-111.274-111.276 0-61.478 49.831-111.276 111.274-111.276zm-47.196 90.05c-3.921-3.86-7.067-6.284-2.162-11.043l15.832-15.455c5.016-5.077 7.959-4.818 12.63-.03l21.34 21.339 21.209-21.208c3.863-3.923 6.284-7.066 11.043-2.164l15.455 15.832c5.077 5.018 4.818 7.961.032 12.63l-21.324 21.325 21.324 21.323c4.786 4.671 5.045 7.614-.032 12.632l-15.455 15.83c-4.759 4.904-7.18 1.761-11.043-2.162l-21.209-21.208-21.34 21.34c-4.671 4.787-7.614 5.046-12.63-.031l-15.832-15.457c-4.905-4.76-1.759-7.181 2.162-11.044l21.226-21.223-21.226-21.226z"/></svg>
																	)}
																</span>
															</TableCell>
																<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	{driver.phone ? (
																			<a
																				href={`tel:${driver.phone.replace(/\s/g, "")}`}
																				className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
																			>
																				{driver.phone}
																			</a>
																		) : (
																			"—"
																		)}
																	</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{driver.empty_miles != null
																			? Math.round(driver.empty_miles)
																			: "—"}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 border-r dark:border-white/[0.08]">
																		{driver.total_miles != null
																			? Math.round(driver.total_miles)
																			: "—"}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																		{driver.rate != null ? `$${Number(driver.rate).toLocaleString("en-US")}` : "—"}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																		{driver.action_time ?? "—"}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-white/[0.08]">
																		<div className="flex items-center gap-1.5">
																			<button
																				type="button"
																				disabled={deletingDriverKey === `${row.id}-${driver.externalId ?? driver.driver_id}`}
																				onClick={async () => {
																					const key = driver.externalId ?? driver.driver_id;
																					if (!key) return;
																					setDeletingDriverKey(`${row.id}-${key}`);
																					const res = await offersApi.removeDriverFromOffer(row.id, key);
																					setDeletingDriverKey(null);
																					if (res.success) {
																						await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																					} else {
																						console.error(res.error);
																					}
																				}}
																				className="min-w-0 flex-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
																			>
																				Delete
																			</button>
																			<button
																				type="button"
																				onClick={() => {
																					// TODO: wire to accept driver for offer API
																				}}
																				className="min-w-0 flex-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
																			>
																				Accept
																			</button>
																		</div>
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
													</div>
													{row.active !== false && (
													<div className="mt-3 flex items-center justify-between gap-3">
														<button
															type="button"
															disabled={deactivatingOfferId === row.id}
															onClick={async () => {
																setDeactivatingOfferId(row.id);
																const res = await offersApi.deactivateOffer(row.id);
																setDeactivatingOfferId(null);
																if (res.success) {
																	await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																} else {
																	console.error(res.error);
																}
															}}
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
														>
															Deactivate offer
															<img
																src="/images/deactivate_offer.png"
																alt=""
																width={31}
																height={31}
																className="h-[31px] w-auto shrink-0"
															/>
														</button>
														<button
															type="button"
															onClick={() => {
																setAddDriversOfferId(row.id);
																setAddDriversExistingDriverIds(
																	Array.from(
																		new Set(
																			(row.drivers ?? []).flatMap(d =>
																				[d.driver_id, d.externalId].filter(
																					(x): x is string => Boolean(x)
																				)
																			)
																		)
																	)
																);
															}}
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-0 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
														>
															Add drivers
															<img
																src="/images/add_icon.png"
																alt=""
																width={31}
																height={31}
																className="h-[31px] w-auto shrink-0"
															/>
														</button>
													</div>
													)}
												</div>
											)}
										</div>
									)}
									{(deactivatingOfferId === row.id ||
										(deletingDriverKey != null && deletingDriverKey.startsWith(`${row.id}-`))) && (
										<div
											className="absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-white/70 dark:bg-white/10"
											aria-hidden
										>
											<SpinnerOne />
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Footer: pagination */}
			<div className="border border-t-0 rounded-b-xl border-gray-100 py-4 pl-[18px] pr-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
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
					{totalPages > 1 && (
						<PaginationWithIcon
							totalPages={totalPages}
							initialPage={currentPage}
							onPageChange={(page: number) => setCurrentPage(page)}
						/>
					)}
				</div>
			</div>

			{addDriversOfferId && (
				<AddDriversModal
					isOpen={true}
					onClose={() => {
						setAddDriversOfferId(null);
						setAddDriversExistingDriverIds([]);
					}}
					offerId={addDriversOfferId}
					existingDriverIds={addDriversExistingDriverIds}
					isSubmitting={isAddingDrivers}
					onAddDrivers={async (offerId, selectedDriverIds) => {
						setIsAddingDrivers(true);
						try {
							const res = await offersApi.addDriversToOffer(offerId, selectedDriverIds);
							if (res.success) {
								await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
							}
						} finally {
							setIsAddingDrivers(false);
						}
					}}
				/>
			)}
		</div>
	);
};

export default OffersList;
