"use client";

import { useEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import PaginationWithIcon from "@/components/tables/DataTables/DriversTable/PaginationWithIcon";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
	DeactivateOfferIcon,
	EditOfferIcon,
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
	BID_WARNING_SECONDS,
	canExtendBidTime,
	formatBidCountdown,
	getBidRemainingSeconds,
	getBidTimerBackgroundColor,
	getNowUnixSeconds,
} from "@/utils/bidTimer";
import { useCurrentUser } from "@/stores/userStore";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import BidRateChatEmbed from "./BidRateChatEmbed";
import BidPlusOneParticipantsPopup from "./BidPlusOneParticipantsPopup";
import EditBidPriceModal from "./EditBidPriceModal";

const ITEMS_PER_PAGE = 10;

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

/** Creation time from unix seconds, shown in America/New_York. */
function formatBidCreatedAtEst(value: number | string | null | undefined): string {
	const sec = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(sec)) return "";
	const date = new Date(sec * 1000);
	const datePart = date.toLocaleDateString("en-US", {
		month: "2-digit",
		day: "2-digit",
		year: "numeric",
		timeZone: "America/New_York",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
		timeZone: "America/New_York",
	});
	return `${datePart} ${timePart} EST`;
}

function formatBidRate(rate: number): string {
	return `$${Number(rate).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
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
	const [editPriceBid, setEditPriceBid] = useState<BidRate | null>(null);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());
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
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, []);

	useEffect(() => {
		if (!currentUser?.id) return;

		for (const row of rows) {
			const isOwner = row.ownerId === currentUser.id;
			if (!isOwner) continue;

			const remainingSeconds = getBidRemainingSeconds(row.updatedAt, nowUnixSec);
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
	}, [rows, nowUnixSec, currentUser?.id]);

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
								nowUnixSec,
							);
							const hasActiveTimer =
								remainingSeconds != null && remainingSeconds > 0;
							const isExpired =
								remainingSeconds != null && remainingSeconds <= 0;
							const canExtend = canExtendBidTime(row.createdAt, row.updatedAt);
							const inWarningWindow =
								hasActiveTimer &&
								remainingSeconds != null &&
								remainingSeconds <= BID_WARNING_SECONDS;
							const showExtendButton = isOwner && inWarningWindow && canExtend;
							const showMaxExtendMessage =
								isOwner && inWarningWindow && !canExtend;
							const isExpanded = expandedBidId === row.id;

							return (
								<div
									key={row.id}
									className="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-theme-xs dark:border-white/50 dark:bg-gray-900"
								>
									<div
										className="cursor-pointer select-none px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
										onClick={() =>
											setExpandedBidId(id => (id === row.id ? null : row.id))
										}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
													<span className="min-w-0 truncate">
														{creatorName}
														{createdAt ? ` ${createdAt}` : null}
														{row.broker?.trim() ? (
															<>
																{" "}
																<span className="text-gray-900 dark:text-white">|</span>
																{" "}
																<span className="text-base text-gray-900 dark:text-white">
																	{row.broker.trim()}
																</span>
															</>
														) : null}
													</span>
													<BidPlusOneParticipantsPopup bidRateId={row.id} />
												</div>
												<p className="text-base font-medium text-gray-900 dark:text-white">
													{routeLabel || "—"}
												</p>
												<div className="flex items-center gap-2">
													<p className="text-xl font-semibold text-brand-600 dark:text-brand-400">
														{formatBidRate(row.rate)}
													</p>
													<button
														type="button"
														title="Edit price"
														aria-label="Edit price"
														onClick={e => {
															e.stopPropagation();
															setEditPriceBid(row);
														}}
														className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-brand-600 hover:opacity-80 dark:text-brand-400"
													>
														<EditOfferIcon className="h-6 w-6" aria-hidden />
													</button>
												</div>
											</div>
											<div className="flex flex-shrink-0 flex-col items-end gap-2">
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

												{hasActiveTimer ? (
													<div className="flex max-w-[280px] flex-col items-end gap-1.5 sm:max-w-xs">
														<div className="flex items-center gap-2">
															<span
																className="inline-flex min-w-[78px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
																style={{
																	backgroundColor: getBidTimerBackgroundColor(
																		remainingSeconds,
																	),
																}}
															>
																{formatBidCountdown(remainingSeconds)}
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
														{showMaxExtendMessage ? (
															<p className="text-right text-xs leading-snug text-gray-800 dark:text-gray-200">
																{
																	"You've reached the maximum bid extension time. No further extensions are available."
																}
															</p>
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

			<EditBidPriceModal
				bid={editPriceBid}
				isOpen={editPriceBid != null}
				onClose={() => setEditPriceBid(null)}
				onSaved={() => {
					queryClient.invalidateQueries({ queryKey: ["bid-rates-list"] }).catch(() => undefined);
				}}
			/>
		</>
	);
}
