"use client";

import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
	ChevronDownIcon,
	ChevronUpIcon,
	DeactivateOfferIcon,
	ExtendBidTimeIcon,
} from "@/icons";
import {
	deleteBidRate,
	extendBidRateTime,
	getBidRates,
	type BidRate,
	type BidRateRoutePoint,
} from "@/app-api/bidRates";
import { abbreviateStateInLocationString } from "@/utils/formatDriverLocation";
import {
	formatNyWallClockSqlString,
	parseNaiveNyDateTime,
} from "@/utils/nyWallClock";
import { useCurrentUser } from "@/stores/userStore";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import BidRateChatEmbed from "./BidRateChatEmbed";

const ITEMS_PER_PAGE = 10;
const BID_TIMER_SECONDS = 15 * 60;
const BID_WARNING_SECONDS = 3 * 60;
const BID_MAX_EXTEND_MS = 3 * BID_TIMER_SECONDS * 1000;

function formatBidCreatorName(owner: BidRate["owner"]): string {
	if (!owner) return "Unknown";
	const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
	return name || "Unknown";
}

/** Full route path: all stops joined by arrows */
function formatBidRoutePath(route: BidRateRoutePoint[] | null | undefined): string {
	if (!Array.isArray(route) || route.length === 0) return "";
	return route
		.map(point => abbreviateStateInLocationString(point.location ?? ""))
		.filter(Boolean)
		.join(" → ");
}

/** Creation time stored as NY wall-clock: MM/DD/YYYY H:MM:SS AM/PM EST */
function formatBidCreatedAtEst(value: string | null | undefined): string {
	const date = parseNaiveNyDateTime(value);
	if (!date) return "";
	const datePart = date.toLocaleDateString("en-US", {
		month: "2-digit",
		day: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
		timeZone: "UTC",
	});
	return `${datePart} ${timePart} EST`;
}

function formatBidRate(rate: number): string {
	return `$${Number(rate).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

function formatCountdown(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [hours, minutes, seconds]
		.map(value => String(value).padStart(2, "0"))
		.join(":");
}

/** Green (full time) → red (near expiry). Hue 120 → 0. */
function getBidTimerBackgroundColor(remainingSeconds: number): string {
	const ratio = Math.min(1, Math.max(0, remainingSeconds / BID_TIMER_SECONDS));
	const hue = Math.round(ratio * 120);
	return `hsl(${hue}, 72%, 42%)`;
}

function getNowNyNaiveMs(now: Date = new Date()): number {
	const parsed = parseNaiveNyDateTime(formatNyWallClockSqlString(now));
	return parsed?.getTime() ?? now.getTime();
}

/** Deadline = updated_at (NY wall-clock) + 15 minutes */
function getBidExpiryNyNaiveMs(updatedAt: string | null | undefined): number | null {
	const updated = parseNaiveNyDateTime(updatedAt);
	if (!updated) return null;
	return updated.getTime() + BID_TIMER_SECONDS * 1000;
}

function getBidRemainingSeconds(
	updatedAt: string | null | undefined,
	nowNyNaiveMs: number,
): number | null {
	const expiryMs = getBidExpiryNyNaiveMs(updatedAt);
	if (expiryMs == null) return null;
	return Math.max(0, Math.floor((expiryMs - nowNyNaiveMs) / 1000));
}

/** Can extend while (updated_at - created_at) < 45 minutes (max 3 × 15 min). */
function canExtendBidTime(
	createdAt: string | null | undefined,
	updatedAt: string | null | undefined,
): boolean {
	const created = parseNaiveNyDateTime(createdAt);
	const updated = parseNaiveNyDateTime(updatedAt);
	if (!created || !updated) return false;
	return updated.getTime() - created.getTime() < BID_MAX_EXTEND_MS;
}

function showBidExpiringToast(bidName: string, bidId: number) {
	const addSystemToast = (
		window as Window & {
			addSystemToastNotification?: (notification: {
				id: string;
				title: string;
				message: string;
				variant?: "success" | "error" | "default";
			}) => void;
		}
	).addSystemToastNotification;

	addSystemToast?.({
		id: `bid-expiring-${bidId}-${Date.now()}`,
		title: "Bid time expiring",
		message: `"${bidName}" time is running out. You can extend it before it expires.`,
		variant: "error",
	});
}

export default function BidRatesList() {
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const webSocketChatSync = useWebSocketChatSync();
	const [currentPage, setCurrentPage] = useState(1);
	const [expandedBidId, setExpandedBidId] = useState<number | null>(null);
	const [deleteConfirmBid, setDeleteConfirmBid] = useState<BidRate | null>(null);
	const [deletingBidId, setDeletingBidId] = useState<number | null>(null);
	const [extendingBidId, setExtendingBidId] = useState<number | null>(null);
	const [nowNyNaiveMs, setNowNyNaiveMs] = useState(() => getNowNyNaiveMs());
	const warnedBidIdsRef = useRef<Set<number>>(new Set());

	const queryParams = {
		page: currentPage,
		limit: ITEMS_PER_PAGE,
	};

	const { data, isPending, isError, error, isPlaceholderData } = useQuery({
		queryKey: ["bid-rates-list", queryParams],
		queryFn: () => getBidRates(queryParams),
		placeholderData: keepPreviousData,
	});

	const rows = data?.data?.results ?? [];
	const pagination = data?.data?.pagination;
	const totalItems = pagination?.total_count ?? 0;
	const totalPages = pagination?.total_pages ?? 1;

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			setNowNyNaiveMs(getNowNyNaiveMs());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, []);

	useEffect(() => {
		if (!currentUser?.id) return;

		for (const row of rows) {
			const isOwner = row.ownerId === currentUser.id;
			if (!isOwner) continue;

			const remainingSeconds = getBidRemainingSeconds(row.updatedAt, nowNyNaiveMs);
			const inWarningWindow =
				remainingSeconds != null &&
				remainingSeconds > 0 &&
				remainingSeconds <= BID_WARNING_SECONDS;
			const canExtend = canExtendBidTime(row.createdAt, row.updatedAt);

			if (inWarningWindow && canExtend) {
				if (!warnedBidIdsRef.current.has(row.id)) {
					warnedBidIdsRef.current.add(row.id);
					const bidName = formatBidRoutePath(row.route) || `Bid #${row.id}`;
					showBidExpiringToast(bidName, row.id);
				}
			} else if (!inWarningWindow) {
				warnedBidIdsRef.current.delete(row.id);
			}
		}
	}, [rows, nowNyNaiveMs, currentUser?.id]);

	async function handleConfirmDelete() {
		if (!deleteConfirmBid) return;
		const bid = deleteConfirmBid;
		setDeletingBidId(bid.id);
		try {
			await deleteBidRate(bid.id);
			setDeleteConfirmBid(null);
			warnedBidIdsRef.current.delete(bid.id);

			const remainingOnPage = rows.length - 1;
			if (remainingOnPage <= 0 && currentPage > 1) {
				setCurrentPage(page => Math.max(1, page - 1));
			}

			await queryClient.invalidateQueries({ queryKey: ["bid-rates-list"] });
		} catch (err) {
			console.error("Failed to delete bid rate:", err);
		} finally {
			setDeletingBidId(null);
		}
	}

	async function handleExtendTime(bid: BidRate) {
		setExtendingBidId(bid.id);
		try {
			await extendBidRateTime(bid.id);
			warnedBidIdsRef.current.delete(bid.id);
			await queryClient.invalidateQueries({ queryKey: ["bid-rates-list"] });
		} catch (err) {
			console.error("Failed to extend bid time:", err);
		} finally {
			setExtendingBidId(null);
		}
	}

	if (isPending && !data) {
		return (
			<div className="flex justify-center py-8">
				<SpinnerOne />
			</div>
		);
	}

	if (isError) {
		const message =
			(error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
			(error as Error)?.message ||
			"Failed to load bid rates";
		return (
			<p className="text-sm text-red-500 dark:text-red-400">{message}</p>
		);
	}

	return (
		<>
			<div className={isPlaceholderData ? "opacity-60" : undefined}>
				{rows.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-12">
						<p className="text-sm text-gray-500 dark:text-gray-400">No bid rates found</p>
					</div>
				) : (
					<div className="space-y-3">
						{rows.map(row => {
							const creatorName = formatBidCreatorName(row.owner);
							const createdAt = formatBidCreatedAtEst(row.createdAt);
							const routeLabel = formatBidRoutePath(row.route);
							const isOwner = Boolean(
								currentUser?.id && row.ownerId && currentUser.id === row.ownerId,
							);
							const remainingSeconds = getBidRemainingSeconds(
								row.updatedAt,
								nowNyNaiveMs,
							);
							const hasActiveTimer =
								remainingSeconds != null && remainingSeconds > 0;
							const isExpired =
								remainingSeconds != null && remainingSeconds <= 0;
							const showExtendButton =
								isOwner &&
								hasActiveTimer &&
								remainingSeconds != null &&
								remainingSeconds <= BID_WARNING_SECONDS &&
								canExtendBidTime(row.createdAt, row.updatedAt);
							const isExpanded = expandedBidId === row.id;

							return (
								<div
									key={row.id}
									className="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/[0.05] dark:bg-gray-900"
								>
									<div
										className="cursor-pointer select-none px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
										onClick={() =>
											setExpandedBidId(id => (id === row.id ? null : row.id))
										}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
													<span className="min-w-0 truncate">
														{creatorName}
														{createdAt ? ` ${createdAt}` : null}
													</span>
													<span className="shrink-0 text-xl font-semibold text-brand-600 dark:text-brand-400">
														{formatBidRate(row.rate)}
													</span>
												</p>
												<p className="text-base font-medium text-gray-900 dark:text-white">
													{routeLabel || "—"}
												</p>
												<p className="truncate text-sm text-gray-700 dark:text-gray-300">
													{row.broker || "—"}
												</p>
											</div>
											<div className="flex flex-shrink-0 flex-col items-end gap-2">
												<div className="flex items-center gap-2">
													{isOwner ? (
														<button
															type="button"
															disabled={deletingBidId === row.id}
															onClick={e => {
																e.stopPropagation();
																setDeleteConfirmBid(row);
															}}
															className="inline-flex h-[39px] items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-0 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
														>
															Delete bid
															<DeactivateOfferIcon
																className="h-5 w-5 shrink-0"
																aria-hidden
															/>
														</button>
													) : null}
													<button
														type="button"
														onClick={e => {
															e.stopPropagation();
															setExpandedBidId(id =>
																id === row.id ? null : row.id,
															);
														}}
														className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-gray-800 dark:hover:text-brand-200"
													>
														<span>{isExpanded ? "Show less" : "Show more"}</span>
														{isExpanded ? (
															<ChevronUpIcon className="h-4 w-4" />
														) : (
															<ChevronDownIcon className="h-4 w-4" />
														)}
													</button>
												</div>

												{hasActiveTimer ? (
													<div className="flex items-center gap-2">
														<span
															className="inline-flex min-w-[78px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
															style={{
																backgroundColor: getBidTimerBackgroundColor(
																	remainingSeconds,
																),
															}}
														>
															{formatCountdown(remainingSeconds)}
														</span>
														{showExtendButton ? (
															<button
																type="button"
																title="Extend bid time"
																disabled={extendingBidId === row.id}
																onClick={e => {
																	e.stopPropagation();
																	handleExtendTime(row).catch(() => undefined);
																}}
																className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
															>
																<ExtendBidTimeIcon className="h-4 w-4" aria-hidden />
																{extendingBidId === row.id ? "…" : "Extend"}
															</button>
														) : null}
													</div>
												) : isExpired ? (
													<span className="text-sm text-gray-800 dark:text-gray-200">
														Bid time Expired
													</span>
												) : null}
											</div>
										</div>
									</div>

									{isExpanded ? (
										<div className="border-t border-gray-100 px-4 py-3 dark:border-white/[0.05]">
											{row.chatId ? (
												<BidRateChatEmbed
													chatRoomId={row.chatId}
													webSocketChatSync={webSocketChatSync}
												/>
											) : (
												<p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
													No chat linked to this bid
												</p>
											)}
										</div>
									) : null}
								</div>
							);
						})}
					</div>
				)}
			</div>

			<div className="mt-4 border-t border-gray-100 pt-4 dark:border-white/[0.05]">
				<div className="flex flex-col xl:flex-row xl:items-center xl:justify-between">
					<div className="pb-3 xl:pb-0">
						<p className="pb-3 text-center text-sm font-medium text-gray-500 border-b border-gray-100 dark:border-gray-800 dark:text-gray-400 xl:border-b-0 xl:pb-0 xl:text-left">
							{totalItems === 0
								? "Showing 0 entries"
								: `Showing ${Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)} to ${Math.min(
										currentPage * ITEMS_PER_PAGE,
										totalItems,
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

			<ConfirmModal
				isOpen={deleteConfirmBid != null}
				onClose={() => setDeleteConfirmBid(null)}
				onConfirm={handleConfirmDelete}
				title="Delete bid"
				message="Are you sure you want to delete this bid? The related chat will also be deleted."
				confirmText="Confirm"
				cancelText="Cancel"
				isLoading={deletingBidId === deleteConfirmBid?.id}
				icon={<DeactivateOfferIcon className="h-6 w-6" aria-hidden />}
				variant="danger"
			/>
		</>
	);
}
