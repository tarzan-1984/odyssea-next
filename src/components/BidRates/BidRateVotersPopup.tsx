"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { getBidRateVoters, voteBidOffer, type BidRateVoter } from "@/app-api/bidRates";
import {
	BidOfferAcceptIcon,
	BidOfferRejectIcon,
	BidParticipantRateIcon,
} from "@/icons";
import { renderAvatar } from "@/helpers";
import {
	BID_RATE_VOTE_FRESH_SECONDS,
	formatBidCountdown,
	getBidRateVoteRemainingSeconds,
	getBidTimerBackgroundColor,
	getNowUnixSeconds,
} from "@/utils/bidTimer";
import {
	ODYSSEA_BID_RATE_UPDATED_EVENT,
	isBidRateRemovedReason,
	type BidRateUpdatedEventDetail,
} from "@/lib/bidRateRealtimeEvents";

function formatVoterName(row: BidRateVoter): string {
	const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
	return name || "Unknown";
}

function formatVoterRate(rate: number | null | undefined): string {
	if (rate == null || !Number.isFinite(rate)) return "—";
	return `$${Number(rate).toLocaleString("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	})}`;
}

const votersCache = new Map<number, BidRateVoter[]>();
const votersInflight = new Map<number, Promise<BidRateVoter[]>>();

export function clearBidRateVotersCache(bidRateId?: number) {
	if (bidRateId != null) {
		votersCache.delete(bidRateId);
		votersInflight.delete(bidRateId);
		return;
	}
	votersCache.clear();
	votersInflight.clear();
}

export function userHasActiveBidRateOffer(
	voters: BidRateVoter[],
	userId: string | null | undefined,
	nowUnixSec: number = getNowUnixSeconds(),
): boolean {
	if (!userId) return false;
	const own = voters.find(row => row.userId === userId);
	if (!own) return false;
	const remaining = getBidRateVoteRemainingSeconds(own.createdRateAt, nowUnixSec);
	return remaining != null && remaining > 0;
}

/** True while the current user still has a live 4-min rate offer on this bid. */
export function useHasActiveBidRateOffer(
	bidRateId: number,
	userId: string | null | undefined,
): boolean {
	const [voters, setVoters] = useState<BidRateVoter[]>(
		() => votersCache.get(bidRateId) ?? [],
	);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());

	useEffect(() => {
		setVoters(votersCache.get(bidRateId) ?? []);
		fetchVotersCached(bidRateId)
			.then(setVoters)
			.catch(() => undefined);
	}, [bidRateId]);

	useEffect(() => {
		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			if (detail?.bidRateId != null && detail.bidRateId !== bidRateId) return;
			votersCache.delete(bidRateId);
			if (isBidRateRemovedReason(detail?.reason)) {
				setVoters([]);
				return;
			}
			fetchVotersCached(bidRateId, { force: true })
				.then(setVoters)
				.catch(() => undefined);
		};
		window.addEventListener(ODYSSEA_BID_RATE_UPDATED_EVENT, onBidRateUpdated);
		return () => {
			window.removeEventListener(
				ODYSSEA_BID_RATE_UPDATED_EVENT,
				onBidRateUpdated,
			);
		};
	}, [bidRateId]);

	const hasActive = userHasActiveBidRateOffer(voters, userId, nowUnixSec);

	useEffect(() => {
		if (!hasActive) return;
		const intervalId = window.setInterval(() => {
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [hasActive]);

	return hasActive;
}

function fetchVotersCached(
	bidRateId: number,
	options?: { force?: boolean },
): Promise<BidRateVoter[]> {
	if (!options?.force) {
		const cached = votersCache.get(bidRateId);
		if (cached) return Promise.resolve(cached);
		const inflight = votersInflight.get(bidRateId);
		if (inflight) return inflight;
	}

	const request = getBidRateVoters(bidRateId)
		.then(result => {
			const rows = result.participants ?? [];
			votersCache.set(bidRateId, rows);
			return rows;
		})
		.finally(() => {
			votersInflight.delete(bidRateId);
		});

	votersInflight.set(bidRateId, request);
	return request;
}

type BidRateVotersPopupProps = {
	bidRateId: number;
};

export default function BidRateVotersPopup({ bidRateId }: BidRateVotersPopupProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [voters, setVoters] = useState<BidRateVoter[]>(
		() => votersCache.get(bidRateId) ?? [],
	);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());
	const [votingUserId, setVotingUserId] = useState<string | null>(null);

	const loadVoters = useCallback(
		async (options?: { force?: boolean; silent?: boolean }) => {
			const hasCache = votersCache.has(bidRateId);
			if (!options?.silent && !hasCache) {
				setLoading(true);
			}
			setError(null);
			try {
				const rows = await fetchVotersCached(bidRateId, {
					force: options?.force,
				});
				setVoters(rows);
			} catch (err) {
				const status = (err as { response?: { status?: number } })?.response
					?.status;
				// Bid may have been deleted while a voters request was in flight.
				if (status !== 404) {
					console.error("Failed to load rate voters:", err);
				}
				setError(status === 404 ? null : "Failed to load voters");
				if (!hasCache) {
					setVoters([]);
				}
			} finally {
				setLoading(false);
			}
		},
		[bidRateId],
	);

	useEffect(() => {
		setVoters(votersCache.get(bidRateId) ?? []);
		setError(null);
		loadVoters({ silent: votersCache.has(bidRateId) }).catch(() => undefined);
	}, [bidRateId, loadVoters]);

	useEffect(() => {
		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			if (detail?.bidRateId != null && detail.bidRateId !== bidRateId) return;
			votersCache.delete(bidRateId);
			if (isBidRateRemovedReason(detail?.reason)) {
				setVoters([]);
				setError(null);
				return;
			}
			loadVoters({ force: true, silent: true }).catch(() => undefined);
		};

		window.addEventListener(ODYSSEA_BID_RATE_UPDATED_EVENT, onBidRateUpdated);
		return () => {
			window.removeEventListener(
				ODYSSEA_BID_RATE_UPDATED_EVENT,
				onBidRateUpdated,
			);
		};
	}, [bidRateId, loadVoters]);

	useEffect(() => {
		if (!isOpen) return;
		const intervalId = window.setInterval(() => {
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [isOpen]);

	function handlePrefetch() {
		if (votersCache.has(bidRateId) || votersInflight.has(bidRateId)) {
			return;
		}
		fetchVotersCached(bidRateId).catch(() => undefined);
	}

	function handleOpen(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		setIsOpen(true);
		const cached = votersCache.get(bidRateId);
		if (cached) {
			setVoters(cached);
		}
		loadVoters({ force: true, silent: Boolean(cached) }).catch(() => undefined);
	}

	function handleClose() {
		setIsOpen(false);
	}

	async function handleVote(offererUserId: string, accept: boolean) {
		setVotingUserId(offererUserId);
		try {
			await voteBidOffer(bidRateId, offererUserId, accept);
			votersCache.delete(bidRateId);
			const rows = await fetchVotersCached(bidRateId, { force: true });
			setVoters(rows);
			// No offers left — close instead of showing empty state.
			if (rows.length === 0) {
				setIsOpen(false);
			}
		} catch (err) {
			console.error("Failed to vote on offer:", err);
			setError(
				(err as { response?: { data?: { error?: string } } })?.response?.data
					?.error ||
					(err as Error)?.message ||
					"Failed to vote on offer",
			);
		} finally {
			setVotingUserId(null);
		}
	}

	const votersCount = voters.length;
	const countLabel = votersCount > 99 ? "99+" : String(votersCount);

	return (
		<div
			className="relative inline-flex shrink-0 items-center gap-1"
			onClick={e => e.stopPropagation()}
			onMouseEnter={handlePrefetch}
			onFocus={handlePrefetch}
		>
			<button
				type="button"
				title="Rate offers"
				aria-label={
					votersCount > 0
						? `Show rate offers (${votersCount})`
						: "Show rate offers"
				}
				aria-haspopup="dialog"
				aria-expanded={isOpen}
				onClick={handleOpen}
				className="inline-flex h-7 w-7 items-center justify-center rounded text-brand-600 hover:opacity-80 dark:text-brand-400"
			>
				<BidParticipantRateIcon className="h-6 w-6" />
			</button>
			{votersCount > 0 ? (
				<span
					className="min-w-[1.25rem] text-sm font-semibold tabular-nums text-brand-600 dark:text-brand-400"
					aria-hidden
				>
					{countLabel}
				</span>
			) : null}

			<Modal
				isOpen={isOpen}
				onClose={handleClose}
				closeOnBackdropClick
				className="relative m-5 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-sm dark:bg-gray-900 sm:m-0 sm:p-8"
			>
				<div onClick={e => e.stopPropagation()}>
					<h4 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
						Rate offers
						{votersCount > 0 ? ` (${votersCount})` : ""}
					</h4>

					{loading && voters.length === 0 ? (
						<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
							Loading…
						</p>
					) : error && voters.length === 0 ? (
						<p className="py-8 text-center text-sm text-red-500 dark:text-red-400">
							{error}
						</p>
					) : voters.length === 0 ? (
						<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
							No recent offers
						</p>
					) : (
						<div className="max-h-[min(60vh,28rem)] overflow-auto rounded-xl border border-gray-200 dark:border-white/10">
							<table className="w-full min-w-[28rem] border-collapse text-left text-sm">
								<thead className="sticky top-0 bg-gray-50 dark:bg-white/[0.04]">
									<tr className="border-b border-gray-200 dark:border-white/10">
										<th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
											Participant
										</th>
										<th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
											Timer
										</th>
										<th className="px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">
											Rate
										</th>
										<th className="px-3 py-2.5 text-center font-semibold text-gray-600 dark:text-gray-300">
											Actions
										</th>
									</tr>
								</thead>
								<tbody>
									{voters.map(row => {
										const remainingSeconds = getBidRateVoteRemainingSeconds(
											row.createdRateAt,
											nowUnixSec,
										);
										const hasTimer =
											remainingSeconds != null && remainingSeconds > 0;
										const isExpired =
											remainingSeconds != null && remainingSeconds <= 0;

										return (
											<tr
												key={row.userId}
												className="border-b border-gray-100 last:border-b-0 dark:border-white/5"
											>
												<td className="px-3 py-2.5">
													<div className="flex min-w-0 items-center gap-2.5">
														{renderAvatar(
															{
																id: row.userId,
																firstName: row.firstName ?? "",
																lastName: row.lastName ?? "",
																profilePhoto: row.profilePhoto ?? undefined,
																avatar: row.profilePhoto ?? "",
																userColor: row.userColor ?? null,
																role: row.role ?? undefined,
															} as Parameters<typeof renderAvatar>[0],
															"h-9 w-9",
														)}
														<span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">
															{formatVoterName(row)}
														</span>
													</div>
												</td>
												<td className="px-3 py-2.5">
													{hasTimer ? (
														<span
															className="inline-flex min-w-[78px] items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
															style={{
																backgroundColor: getBidTimerBackgroundColor(
																	remainingSeconds,
																	BID_RATE_VOTE_FRESH_SECONDS,
																),
															}}
														>
															{formatBidCountdown(remainingSeconds)}
														</span>
													) : isExpired ? (
														<span className="text-xs font-medium text-gray-800 dark:text-gray-200">
															Expired
														</span>
													) : (
														<span className="text-xs text-gray-400">—</span>
													)}
												</td>
												<td className="px-3 py-2.5">
													<span className="font-semibold tabular-nums text-brand-600 dark:text-brand-400">
														{formatVoterRate(row.rate)}
													</span>
												</td>
												<td className="px-3 py-2.5">
													{row.canVote ? (
														<div className="flex items-center justify-center gap-2">
															<button
																type="button"
																title="Accept offer"
																aria-label={`Accept offer from ${formatVoterName(row)}`}
																disabled={votingUserId === row.userId}
																onClick={e => {
																	e.stopPropagation();
																	handleVote(row.userId, true).catch(
																		() => undefined,
																	);
																}}
																className="inline-flex h-8 w-8 items-center justify-center rounded-md text-green-600 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/30"
															>
																<BidOfferAcceptIcon className="h-5 w-5" />
															</button>
															<button
																type="button"
																title="Reject offer"
																aria-label={`Reject offer from ${formatVoterName(row)}`}
																disabled={votingUserId === row.userId}
																onClick={e => {
																	e.stopPropagation();
																	handleVote(row.userId, false).catch(
																		() => undefined,
																	);
																}}
																className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
															>
																<BidOfferRejectIcon className="h-5 w-5" />
															</button>
														</div>
													) : (
														<span className="block text-center text-xs text-gray-400">
															—
														</span>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</Modal>
		</div>
	);
}
