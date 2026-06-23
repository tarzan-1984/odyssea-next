"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWebSocketConnectionCheck } from "@/hooks/useWebSocketConnectionCheck";
import Image from "next/image";
import CustomStaticSelect from "@/components/ui/select/CustomSelect";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import { useCurrentUser } from "@/stores/userStore";
import { ChevronDownIcon, ChevronUpIcon, ExtendBidTimeIcon, OfferDriverChatIcon, DeactivateOfferIcon, AddPlusCircleIcon } from "@/icons";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import offersApi, { formatRoute, routeSummary } from "@/app-api/offers";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import type { OfferRow, OfferDriver } from "@/app-api/offers";
import AddDriversModal from "@/components/tables/DataTables/DriversTable/AddDriversModal";
import CheckListPushModal from "@/components/tables/DataTables/CheckListTable/CheckListPushModal";
import type { CheckListDriver } from "@/components/tables/DataTables/CheckListTable/checkListTypes";
import UserFilterSelect from "./UserFilterSelect";
import { buildOfferChatUrl } from "@/utils/offerChatUrl";
import { buildTmsDriverPageUrl } from "@/utils/tmsUrls";
import { canModifyOffers } from "@/utils/roleAccess";

/** Format date string (e.g. "02/16/2026, 05:26:26" or ISO) to mm/dd/YY */
const CREATOR_ROLE_LABELS: Record<string, string> = {
	ADMINISTRATOR: "Administrator",
	DISPATCHER: "Dispatcher",
	DISPATCHER_TL: "Dispatcher TL",
	EXPEDITE_MANAGER: "Expedite Manager",
	MORNING_TRACKING: "Morning Tracking",
	NIGHTSHIFT_TRACKING: "Nightshift Tracking",
};

function formatOfferCreatorLabel(creator: OfferRow["creator"]): string | null {
	if (!creator) return null;

	const name = [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
	const role = creator.role?.trim();

	if (!name && !role) return null;

	const parts = [name || ""];
	if (role) {
		const roleLabel = CREATOR_ROLE_LABELS[role] ?? role.replace(/_/g, " ");
		parts.push(`(${roleLabel})`);
	}

	return parts.join(" ");
}

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

function hasHazmat(specialRequirements: unknown): boolean {
	if (!specialRequirements) return false;
	if (Array.isArray(specialRequirements)) {
		return specialRequirements.some((v) => String(v).toLowerCase() === "hazmat");
	}
	return String(specialRequirements).toLowerCase().includes("hazmat");
}

function normalizeUnixSeconds(value: unknown): number | null {
	if (value == null || value === "") return null;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return null;
	return Math.floor(parsed);
}

function formatCountdown(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map((value) => String(value).padStart(2, "0"))
		.join(":");
}

function canExtendDriverBidTime(offer: OfferRow, driver: OfferDriver): boolean {
	return (
		offer.active !== false &&
		!offer.is_driver_selected &&
		driver.active !== false &&
		driver.rate != null
	);
}

function getDriverBidSortPriority(driver: OfferDriver, nowUnixSeconds: number): number {
	if (driver.active === false) return 3;

	const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
	const hasActiveTimer =
		driver.rate != null &&
		actionTimeUnix != null &&
		actionTimeUnix > nowUnixSeconds;

	if (hasActiveTimer) return 0;

	const hasExpiredTimer = actionTimeUnix != null && actionTimeUnix <= nowUnixSeconds;
	if (hasExpiredTimer) return 1;

	return 2;
}

function sortOfferDriversByBidStatus(
	drivers: OfferDriver[],
	nowUnixSeconds: number
): OfferDriver[] {
	return [...drivers].sort((a, b) => {
		const priorityA = getDriverBidSortPriority(a, nowUnixSeconds);
		const priorityB = getDriverBidSortPriority(b, nowUnixSeconds);
		if (priorityA !== priorityB) return priorityA - priorityB;

		const actionTimeA = normalizeUnixSeconds(a.action_time);
		const actionTimeB = normalizeUnixSeconds(b.action_time);

		if (priorityA === 0) {
			return (actionTimeA ?? Number.MAX_SAFE_INTEGER) - (actionTimeB ?? Number.MAX_SAFE_INTEGER);
		}

		if (priorityA === 1) {
			return (actionTimeB ?? 0) - (actionTimeA ?? 0);
		}

		return 0;
	});
}

function getParticipatingOfferDrivers(drivers: OfferDriver[] | undefined): OfferDriver[] {
	return (
		drivers?.filter(
			(d) =>
				d.active !== false &&
				(d.rate != null || normalizeUnixSeconds(d.action_time) != null)
		) ?? []
	);
}

function OfferDriverBadge({
	offer,
	driver,
	driverIdx,
	nowUnixSeconds,
	canModifyOffersByRole,
	onPushClick,
}: {
	offer: OfferRow;
	driver: OfferDriver;
	driverIdx: number;
	nowUnixSeconds: number;
	canModifyOffersByRole: boolean;
	onPushClick: (offer: OfferRow, driver: OfferDriver) => void;
}) {
	const driverName = [
		driver.externalId != null ? `(${driver.externalId})` : null,
		[driver.firstName, driver.lastName].filter(Boolean).join(" ") || "",
	]
		.filter(Boolean)
		.join(" ");
	const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
	const remainingSeconds =
		actionTimeUnix != null ? Math.max(0, actionTimeUnix - nowUnixSeconds) : null;

	const isInactiveDriver = driver.active === false;
	const hasActiveTimer =
		!isInactiveDriver && remainingSeconds != null && remainingSeconds > 0;
	const isExpiredBid =
		!isInactiveDriver &&
		actionTimeUnix != null &&
		(remainingSeconds == null || remainingSeconds <= 0);

	return (
		<div
			className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
				isInactiveDriver
					? "border-transparent bg-[#f5b8ab] dark:border-red-800/35 dark:bg-red-950/50"
					: hasActiveTimer
						? "border-transparent bg-[#d4e8d7] dark:border-green-800/35 dark:bg-green-950/45"
						: isExpiredBid
							? "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700/70"
							: "border-gray-200 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.04]"
			}`}
		>
			<span
				className={`max-w-[180px] truncate text-xs font-medium ${
					isInactiveDriver
						? "font-semibold text-[#a20000] dark:text-red-100"
						: hasActiveTimer
							? "font-semibold text-green-900 dark:text-green-100"
							: isExpiredBid
								? "text-gray-600 dark:text-gray-300"
								: "text-gray-700 dark:text-gray-300"
				}`}
			>
				{driverName}
			</span>
			{isInactiveDriver ? null : remainingSeconds != null && remainingSeconds > 0 ? (
				<span className="inline-flex min-w-[64px] items-center justify-center rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
					{formatCountdown(remainingSeconds)}
				</span>
			) : actionTimeUnix != null ? (
				<ExtendBidTimeButton
					offer={offer}
					driver={driver}
					disabled={!canModifyOffersByRole}
					onPushClick={onPushClick}
				/>
			) : null}
		</div>
	);
}

function buildExtendBidTimePushMessage(offer: OfferRow): string {
	const offerName = routeSummary(offer.route) || `Offer #${offer.id}`;
	return `Please extend the bid time for the offer - ${offerName}`;
}

const DRIVER_TABLE_COL_UNIT = "280px";
const DRIVER_TABLE_COL_PHONE = "130px";
const DRIVER_TABLE_COL_EMPTY_MILES = "88px";
const DRIVER_TABLE_COL_TOTAL_MILES = "96px";
const DRIVER_TABLE_COL_BID_TIMER = "126px";

function fixedDriverTableCol(width: string) {
	return { width, minWidth: width, maxWidth: width };
}

function offerDriverToCheckListDriver(driver: OfferDriver): CheckListDriver {
	return {
		id: driver.driver_id,
		firstName: driver.firstName,
		lastName: driver.lastName,
		email: driver.email,
		externalId: driver.externalId,
		phone: driver.phone ?? "",
		driverStatus: driver.status,
		lastActiveApp: null,
		lastLocationUpdateAt: null,
		trackingLoadId: null,
	};
}

function ExtendBidTimeButton({
	offer,
	driver,
	onPushClick,
	disabled = false,
}: {
	offer: OfferRow;
	driver: OfferDriver;
	onPushClick: (offer: OfferRow, driver: OfferDriver) => void;
	disabled?: boolean;
}) {
	const driverKey = driver.externalId ?? driver.driver_id;
	const canExtend = canExtendDriverBidTime(offer, driver);

	if (!canExtend || !driverKey) return null;

	return (
		<button
			type="button"
			title="Send push notification"
			disabled={disabled}
			onClick={(e) => {
				e.stopPropagation();
				if (disabled) return;
				onPushClick(offer, driver);
			}}
			className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-gray-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-brand-400 dark:disabled:hover:bg-transparent dark:disabled:hover:text-gray-300"
		>
			<ExtendBidTimeIcon className="h-4 w-4" />
		</button>
	);
}

const OffersList = () => {
	useWebSocketConnectionCheck();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const [currentPage, setCurrentPage] = useState(1);
	const [itemsPerPage, setItemsPerPage] = useState(10);
	const [expandedOfferId, setExpandedOfferId] = useState<number | null>(null);
	const [addDriversOfferId, setAddDriversOfferId] = useState<number | null>(null);
	const [addDriversExistingDriverIds, setAddDriversExistingDriverIds] = useState<string[]>([]);
	const [isAddingDrivers, setIsAddingDrivers] = useState(false);
	const [deletingDriverKey, setDeletingDriverKey] = useState<string | null>(null);
	const [returningDriverKey, setReturningDriverKey] = useState<string | null>(null);
	const [acceptingDriverKey, setAcceptingDriverKey] = useState<string | null>(null);
	const [deactivatingOfferId, setDeactivatingOfferId] = useState<number | null>(null);
	const [pushModalTarget, setPushModalTarget] = useState<{
		offer: OfferRow;
		driver: OfferDriver;
	} | null>(null);
	const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
	const [userFilterId, setUserFilterId] = useState("");
	const [nowUnixSeconds, setNowUnixSeconds] = useState(() =>
		Math.floor(Date.now() / 1000)
	);

	const isAdmin = currentUser?.role === "ADMINISTRATOR";
	const showOfferId =
		isAdmin && String(currentUser?.externalId ?? "").trim() === "83";
	const canModifyOffersByRole = canModifyOffers(currentUser?.role);
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

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowUnixSeconds(Math.floor(Date.now() / 1000));
		}, 1000);

		return () => window.clearInterval(intervalId);
	}, []);

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

						<p className="text-sm text-gray-500 dark:text-gray-400">No offers found</p>
					</div>
				) : (
					<div className="space-y-3">
						{results.map((row) => {
							const isExpanded = expandedOfferId === row.id;
							const creatorLabel = isAdmin ? formatOfferCreatorLabel(row.creator) : null;
							const allDriversInactive =
								(row.drivers?.length ?? 0) > 0 &&
								row.drivers!.every((d) => d.active === false);
							const headerHighlightRed = row.active === false || allDriversInactive;
							return (
								<div
									key={row.id}
									className="relative w-full rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/[0.05] dark:bg-gray-900 overflow-hidden"
								>
								<div
									className={`px-4 py-3 cursor-pointer select-none transition-colors ${
										headerHighlightRed
											? "bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
											: "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
									}`}
									onClick={() =>
										setExpandedOfferId((id) => (id === row.id ? null : row.id))
									}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="flex min-w-0 flex-1 items-center gap-2">
											<p className="text-base font-medium text-gray-900 dark:text-white truncate">
												<span className="mr-3">{formatDateMmDdYy(row.create_time)}</span>
												{routeSummary(row.route) ||
													`${abbreviateStateInLocationString(row.pick_up_location ?? "")} - ${abbreviateStateInLocationString(row.delivery_location ?? "")}`}
												{showOfferId && <> (id: {row.id})</>}
											</p>
											{hasHazmat(row.special_requirements) && (
												<Image
													src="/images/hazmat.png"
													alt="Hazmat"
													width={42}
													height={42}
													className="flex-shrink-0 object-contain"
												/>
											)}
										</div>
										<div className="flex flex-shrink-0 items-center justify-center gap-2">
											{row.active !== false && (
												<button
													type="button"
													disabled={!canModifyOffersByRole || deactivatingOfferId === row.id}
													onClick={async (e) => {
														e.stopPropagation();
														if (!canModifyOffersByRole) return;
														setDeactivatingOfferId(row.id);
														const res = await offersApi.deactivateOffer(row.id);
														setDeactivatingOfferId(null);
														if (res.success) {
															await queryClient.invalidateQueries({
																queryKey: ["offers-list-cards"],
															});
														} else {
															console.error(res.error);
														}
													}}
													className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
												>
													Deactivate offer
													<DeactivateOfferIcon className="h-5 w-5 shrink-0" aria-hidden />
												</button>
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													setExpandedOfferId((id) => (id === row.id ? null : row.id));
												}}
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
									<div className="flex flex-col gap-1 min-w-0">
										{creatorLabel && (
											<p className="text-sm text-gray-500 dark:text-gray-400 truncate">
												{creatorLabel}
											</p>
										)}
										{/* Driver rows: active timers first, expired timers below */}
										{(() => {
											const participatingDrivers = getParticipatingOfferDrivers(row.drivers);
											const activeTimerDrivers = sortOfferDriversByBidStatus(
												participatingDrivers.filter(
													(d) => getDriverBidSortPriority(d, nowUnixSeconds) === 0
												),
												nowUnixSeconds
											);
											const expiredTimerDrivers = sortOfferDriversByBidStatus(
												participatingDrivers.filter(
													(d) => getDriverBidSortPriority(d, nowUnixSeconds) !== 0
												),
												nowUnixSeconds
											);
											if (activeTimerDrivers.length === 0 && expiredTimerDrivers.length === 0) {
												return null;
											}
											return (
												<div className="mt-2 flex flex-col gap-2">
													{activeTimerDrivers.length > 0 && (
														<div className="flex flex-wrap items-center gap-2">
															{activeTimerDrivers.map((driver, driverIdx) => (
																<OfferDriverBadge
																	key={`${row.id}-active-${driver.driver_id ?? driver.externalId ?? driverIdx}`}
																	offer={row}
																	driver={driver}
																	driverIdx={driverIdx}
																	nowUnixSeconds={nowUnixSeconds}
																	canModifyOffersByRole={canModifyOffersByRole}
																	onPushClick={(offer, driverItem) => {
																		setPushModalTarget({ offer, driver: driverItem });
																	}}
																/>
															))}
														</div>
													)}
													{expiredTimerDrivers.length > 0 && (
														<div className="flex flex-wrap items-center gap-2">
															{expiredTimerDrivers.map((driver, driverIdx) => (
																<OfferDriverBadge
																	key={`${row.id}-expired-${driver.driver_id ?? driver.externalId ?? driverIdx}`}
																	offer={row}
																	driver={driver}
																	driverIdx={driverIdx}
																	nowUnixSeconds={nowUnixSeconds}
																	canModifyOffersByRole={canModifyOffersByRole}
																	onPushClick={(offer, driverItem) => {
																		setPushModalTarget({ offer, driver: driverItem });
																	}}
																/>
															))}
														</div>
													)}
												</div>
											);
										})()}
									</div>
								</div>
									{isExpanded && (
										<div className="border-t border-gray-100 dark:border-white/[0.05] px-4 py-3">
											<div className="w-full max-w-[1300px]">
											<h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
												Details
											</h3>
											<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
												<Table className="w-full border-collapse table-fixed">
													<colgroup>
														<col style={{ width: "340px" }} />
														<col style={{ width: "90px" }} />
														<col style={{ width: "110px" }} />
														<col style={{ width: "170px" }} />
														<col style={{ width: "296px" }} />
													</colgroup>
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
																{formatRoute(row.route) || ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.weight != null ? `${Number(row.weight).toLocaleString("en-US")} lbs` : ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.commodity ?? ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{formatSpecialRequirements(row.special_requirements) || ""}
															</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																{row.notes && String(row.notes).trim()
																	? String(row.notes).trim()
																	: ""}
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
													<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-white/[0.08]">
													<Table className="w-full border-collapse table-fixed">
												<colgroup>
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_UNIT)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_PHONE)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_EMPTY_MILES)} />
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_TOTAL_MILES)} />
													<col
														style={fixedDriverTableCol(row.is_driver_selected ? "96px" : "88px")}
													/>
													<col style={fixedDriverTableCol(DRIVER_TABLE_COL_BID_TIMER)} />
													{!row.is_driver_selected && (
														<col style={fixedDriverTableCol("168px")} />
													)}
												</colgroup>
														<TableHeader className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04]">
															<TableRow className="border-gray-200 dark:border-white/[0.08]">
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																Unit
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																Phone
															</TableCell>
															<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																Empty miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	Total miles
																</TableCell>
																<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08]">
																	Rate
																</TableCell>
																<TableCell isHeader className="px-2 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	Bid timer
																</TableCell>
																{!row.is_driver_selected && (
																	<TableCell isHeader className="px-3 py-2 text-theme-xs font-bold text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/[0.08]">
																		Actions
																	</TableCell>
																)}
															</TableRow>
														</TableHeader>
														<TableBody>
															{sortOfferDriversByBidStatus(row.drivers ?? [], nowUnixSeconds).map((driver, driverIndex) => {
																const driverUnitId = driver.externalId ?? driver.driver_id;
																const driverDisplayName = [
																	driver.externalId != null ? `(${driver.externalId})` : null,
																	[driver.firstName, driver.lastName].filter(Boolean).join(" ") || "",
																]
																	.filter(Boolean)
																	.join(" ");
																const tmsDriverUrl = buildTmsDriverPageUrl(driver.externalId);

																return (
																<TableRow
																	key={`${row.id}-${driver.driver_id ?? driver.externalId ?? driverIndex}`}
																	className={`border-gray-200 dark:border-white/[0.08] ${driver.is_selected ? "bg-green-100 dark:bg-green-900/25" : driver.active === false ? "bg-red-100 dark:bg-red-900/25" : ""}`}
																>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																<span className="inline-flex items-center gap-1.5">
																	{driverUnitId ? (
																		<Link
																			href={buildOfferChatUrl(String(row.id), driverUnitId)}
																			title="Open offer chat"
																			onClick={(e) => e.stopPropagation()}
																			className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 dark:text-brand-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
																		>
																			<OfferDriverChatIcon className="h-4 w-4" />
																		</Link>
																	) : null}
																	{tmsDriverUrl ? (
																		<a
																			href={tmsDriverUrl}
																			target="_blank"
																			rel="noopener noreferrer"
																			onClick={(e) => e.stopPropagation()}
																			className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
																		>
																			{driverDisplayName}
																		</a>
																	) : (
																		<span>{driverDisplayName}</span>
																	)}
																	{driver.status?.toUpperCase() === "ACTIVE" ? (
																		<svg className="shrink-0 w-5 h-5 text-gray-900 dark:text-white" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 397 511.911"><path fill="currentColor" d="M62.087 0h168.92c17.125 0 32.753 6.988 43.891 18.212 11.293 11.306 18.184 26.85 18.184 43.89v36.586c-2.371-.11-4.755-.173-7.154-.173-4.28 0-8.515.188-12.704.538V61.507H19.771v364.164h253.453v-26.146c4.189.35 8.424.537 12.704.537a154.3 154.3 0 007.154-.172v49.934c0 17.138-6.975 32.766-18.184 43.891-11.322 11.321-26.85 18.196-43.891 18.196H62.087c-17.138 0-32.765-6.972-43.89-18.196C6.89 482.421 0 466.878 0 449.824V62.018c0-17.14 6.975-32.767 18.197-43.905C29.49 6.819 44.949 0 62.087 0zm84.376 445.096c14.046 0 25.523 11.308 25.523 25.523 0 14.061-11.306 25.538-25.523 25.538-14.046 0-25.538-11.307-25.538-25.538 0-14.031 11.309-25.523 25.538-25.523z"/><path fill="#00A912" d="M285.928 138.216c61.364 0 111.072 49.739 111.072 111.072 0 61.364-49.74 111.072-111.072 111.072-61.364 0-111.073-49.74-111.073-111.072 0-61.366 49.74-111.072 111.073-111.072zm-35.903 94.85l19.688 18.593 49.388-50.017c3.857-3.916 6.274-7.055 11.025-2.161l15.426 15.803c5.068 5.01 4.809 7.945.032 12.608l-67.062 66.023c-10.075 9.875-8.32 10.48-18.538.347l-35.921-35.722c-2.132-2.304-1.902-4.634.428-6.937l17.907-18.569c2.713-2.856 4.874-2.607 7.627.032z"/></svg>
																	) : (
																		<svg className="shrink-0 w-5 h-5 text-gray-900 dark:text-white" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision" textRendering="geometricPrecision" imageRendering="optimizeQuality" fillRule="evenodd" clipRule="evenodd" viewBox="0 0 397 511.546"><path fill="currentColor" d="M62.043 0h168.8c17.112 0 32.728 6.983 43.859 18.199 11.285 11.298 18.171 26.831 18.171 43.859v36.559a155.489 155.489 0 00-7.149-.172c-4.277 0-8.509.188-12.695.537V61.463H19.757v363.905h253.272V399.24c4.186.349 8.418.537 12.695.537 2.397 0 4.78-.063 7.149-.173v49.9c0 17.125-6.97 32.741-18.171 43.858-11.314 11.314-26.831 18.184-43.859 18.184h-168.8c-17.126 0-32.742-6.967-43.859-18.184C6.885 482.077 0 466.545 0 449.504V61.974C0 44.846 6.97 29.23 18.184 18.1 29.469 6.814 44.917 0 62.043 0zm84.316 444.778c14.036 0 25.505 11.301 25.505 25.505 0 14.051-11.299 25.52-25.505 25.52-14.036 0-25.52-11.298-25.52-25.52 0-14.021 11.3-25.505 25.52-25.505z"/><path fill="#F44336" d="M285.724 137.837c61.478 0 111.276 49.83 111.276 111.276 0 61.476-49.83 111.276-111.276 111.276-61.476 0-111.274-49.832-111.274-111.276 0-61.478 49.831-111.276 111.274-111.276zm-47.196 90.05c-3.921-3.86-7.067-6.284-2.162-11.043l15.832-15.455c5.016-5.077 7.959-4.818 12.63-.03l21.34 21.339 21.209-21.208c3.863-3.923 6.284-7.066 11.043-2.164l15.455 15.832c5.077 5.018 4.818 7.961.032 12.63l-21.324 21.325 21.324 21.323c4.786 4.671 5.045 7.614-.032 12.632l-15.455 15.83c-4.759 4.904-7.18 1.761-11.043-2.162l-21.209-21.208-21.34 21.34c-4.671 4.787-7.614 5.046-12.63-.031l-15.832-15.457c-4.905-4.76-1.759-7.181 2.162-11.044l21.226-21.223-21.226-21.226z"/></svg>
																	)}
																</span>
															</TableCell>
																<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																	{driver.phone ? (
																			<a
																				href={`tel:${driver.phone.replace(/\s/g, "")}`}
																				className="text-brand-600 underline hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
																			>
																				{driver.phone}
																			</a>
																		) : null}
																	</TableCell>
															<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																{driver.empty_miles != null
																			? Math.round(driver.empty_miles)
																			: ""}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 border-r dark:border-white/[0.08] whitespace-nowrap">
																		{driver.total_miles != null
																			? Math.round(driver.total_miles)
																			: ""}
																	</TableCell>
																	<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08]">
																		{driver.rate != null ? `$${Number(driver.rate).toLocaleString("en-US")}` : ""}
																	</TableCell>
																	<TableCell className="px-2 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-r border-gray-200 dark:border-white/[0.08] whitespace-nowrap">
																		{(() => {
																			const actionTimeUnix = normalizeUnixSeconds(driver.action_time);
																			if (actionTimeUnix == null) return null;

																			const remainingSeconds = Math.max(0, actionTimeUnix - nowUnixSeconds);
																			if (remainingSeconds > 0) {
																				return (
																					<span className="inline-flex min-w-[78px] items-center justify-center rounded-full bg-brand-600 px-2 py-1 text-xs font-semibold text-white">
																						{formatCountdown(remainingSeconds)}
																					</span>
																				);
																			}

																			return (
																				<span className="inline-flex items-center gap-1">
																					<span className="text-theme-sm text-gray-800 dark:text-gray-200">
																						Offer Expired
																					</span>
																					<ExtendBidTimeButton
																						offer={row}
																						driver={driver}
																						disabled={!canModifyOffersByRole}
																						onPushClick={(offer, driverItem) => {
																							setPushModalTarget({ offer, driver: driverItem });
																						}}
																					/>
																				</span>
																			);
																		})()}
																	</TableCell>
																	{!row.is_driver_selected && (
																		<TableCell className="px-3 py-2 text-theme-sm text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-white/[0.08]">
																			{driver.active === false ? (
																				<button
																					type="button"
																					disabled={
																						!canModifyOffersByRole ||
																						returningDriverKey === `${row.id}-${driver.externalId ?? driver.driver_id}`
																					}
																					onClick={async () => {
																						if (!canModifyOffersByRole) return;
																						const key = driver.externalId ?? driver.driver_id;
																						if (!key) return;
																						setReturningDriverKey(`${row.id}-${key}`);
																						const res = await offersApi.returnDriverToOffer(row.id, key);
																						setReturningDriverKey(null);
																						if (res.success) {
																							await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																						} else {
																							console.error(res.error);
																						}
																					}}
																					className="w-full rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
																				>
																					Return
																				</button>
																			) : (
																				<div className="flex items-center gap-1.5">
																					<button
																						type="button"
																						disabled={
																							!canModifyOffersByRole ||
																							deletingDriverKey === `${row.id}-${driver.externalId ?? driver.driver_id}`
																						}
																						onClick={async () => {
																							if (!canModifyOffersByRole) return;
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
																						disabled={
																							!canModifyOffersByRole ||
																							acceptingDriverKey === `${row.id}-${driver.externalId ?? driver.driver_id}` ||
																							driver.rate == null
																						}
																						title={driver.rate == null ? 'Rate is not set' : undefined}
																					onClick={() => {
																						if (!canModifyOffersByRole) return;
																						const key = driver.externalId ?? driver.driver_id;
																						if (!key) return;
																						setAcceptingDriverKey(`${row.id}-${key}`);
																						offersApi
																							.selectDriverForOffer(row.id, key)
																							.then(async (res) => {
																								if (res.success) {
																									await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
																									await queryClient.refetchQueries({ queryKey: ["offers-list-cards"], type: "active" });
																								} else {
																									console.error(res.error);
																								}
																							})
																							.finally(() => {
																								setAcceptingDriverKey(null);
																							});
																						}}
																						className="min-w-0 flex-1 rounded-md border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
																					>
																						Accept
																					</button>
																				</div>
																			)}
																		</TableCell>
																	)}
																</TableRow>
															);
															})}
														</TableBody>
													</Table>
													</div>
													{row.active !== false && !row.is_driver_selected && (
													<div className="mt-3 flex items-center justify-start gap-3">
														<button
															type="button"
															disabled={!canModifyOffersByRole}
															onClick={() => {
																if (!canModifyOffersByRole) return;
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
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-0 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-600 dark:bg-brand-500 dark:hover:bg-brand-600 dark:disabled:hover:bg-brand-500"
														>
									Add drivers
									<AddPlusCircleIcon />
														</button>
													</div>
													)}
												</div>
											)}
											</div>
										</div>
									)}
									{(deactivatingOfferId === row.id ||
										(deletingDriverKey != null && deletingDriverKey.startsWith(`${row.id}-`)) ||
										(returningDriverKey != null && returningDriverKey.startsWith(`${row.id}-`)) ||
										(acceptingDriverKey != null && acceptingDriverKey.startsWith(`${row.id}-`))) && (
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
					onAddDrivers={async (offerId, selectedDriverIds, driverEmptyMiles) => {
						setIsAddingDrivers(true);
						try {
							const res = await offersApi.addDriversToOffer(
								offerId,
								selectedDriverIds,
								driverEmptyMiles
							);
							if (res.success) {
								await queryClient.invalidateQueries({ queryKey: ["offers-list-cards"] });
							}
						} finally {
							setIsAddingDrivers(false);
						}
					}}
				/>
			)}

			<CheckListPushModal
				isOpen={pushModalTarget != null}
				onClose={() => setPushModalTarget(null)}
				drivers={
					pushModalTarget ? [offerDriverToCheckListDriver(pushModalTarget.driver)] : null
				}
				defaultMessage={
					pushModalTarget ? buildExtendBidTimePushMessage(pushModalTarget.offer) : undefined
				}
			/>
		</div>
	);
};

export default OffersList;
