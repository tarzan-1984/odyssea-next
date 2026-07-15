"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import {
	getBidParticipants,
	type BidAuctionParticipant,
} from "@/app-api/bidRates";
import { AddedValueIcon } from "@/icons";
import { renderAvatar } from "@/helpers";
import {
	formatBidCountdown,
	getBidRemainingSeconds,
	getBidTimerBackgroundColor,
	getNowNyNaiveMs,
} from "@/utils/bidTimer";

function formatParticipantName(row: BidAuctionParticipant): string {
	const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
	return name || "Unknown";
}

/** In-memory cache so reopen / hover prefetch skips the loading wait. */
const participantsCache = new Map<number, BidAuctionParticipant[]>();
const participantsInflight = new Map<number, Promise<BidAuctionParticipant[]>>();

function fetchParticipantsCached(
	bidRateId: number,
	options?: { force?: boolean },
): Promise<BidAuctionParticipant[]> {
	if (!options?.force) {
		const cached = participantsCache.get(bidRateId);
		if (cached) return Promise.resolve(cached);
		const inflight = participantsInflight.get(bidRateId);
		if (inflight) return inflight;
	}

	const request = getBidParticipants(bidRateId)
		.then(result => {
			const rows = result.participants ?? [];
			participantsCache.set(bidRateId, rows);
			return rows;
		})
		.finally(() => {
			participantsInflight.delete(bidRateId);
		});

	participantsInflight.set(bidRateId, request);
	return request;
}

type BidPlusOneParticipantsPopupProps = {
	bidRateId: number;
};

export default function BidPlusOneParticipantsPopup({
	bidRateId,
}: BidPlusOneParticipantsPopupProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [participants, setParticipants] = useState<BidAuctionParticipant[]>(
		() => participantsCache.get(bidRateId) ?? [],
	);
	const [nowNyNaiveMs, setNowNyNaiveMs] = useState(() => getNowNyNaiveMs());
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		setParticipants(participantsCache.get(bidRateId) ?? []);
		setError(null);
	}, [bidRateId]);

	useEffect(() => {
		if (!isOpen) return;
		const intervalId = window.setInterval(() => {
			setNowNyNaiveMs(getNowNyNaiveMs());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [isOpen]);

	const loadParticipants = useCallback(
		async (options?: { force?: boolean; silent?: boolean }) => {
			const hasCache = participantsCache.has(bidRateId);
			if (!options?.silent && !hasCache) {
				setLoading(true);
			}
			setError(null);
			try {
				const rows = await fetchParticipantsCached(bidRateId, {
					force: options?.force,
				});
				setParticipants(rows);
			} catch (err) {
				console.error("Failed to load +1 participants:", err);
				setError("Failed to load participants");
				if (!hasCache) {
					setParticipants([]);
				}
			} finally {
				setLoading(false);
			}
		},
		[bidRateId],
	);

	function handlePrefetch() {
		if (participantsCache.has(bidRateId) || participantsInflight.has(bidRateId)) {
			return;
		}
		fetchParticipantsCached(bidRateId).catch(() => undefined);
	}

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		const next = !isOpen;
		setIsOpen(next);
		if (next) {
			const cached = participantsCache.get(bidRateId);
			if (cached) {
				setParticipants(cached);
			}
			loadParticipants({ force: Boolean(cached), silent: Boolean(cached) }).catch(
				() => undefined,
			);
		}
	}

	return (
		<div
			className="relative inline-flex shrink-0"
			onClick={e => e.stopPropagation()}
			onMouseEnter={handlePrefetch}
			onFocus={handlePrefetch}
		>
			<button
				ref={buttonRef}
				type="button"
				title="Participants"
				aria-label="Show participants"
				aria-expanded={isOpen}
				onClick={handleToggle}
				className="dropdown-toggle inline-flex items-center justify-center rounded-md p-0.5 text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-white/[0.06]"
			>
				<AddedValueIcon className="h-8 w-8" />
			</button>

			<Dropdown
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				anchorRef={buttonRef}
				anchorAlign="left"
				className="max-h-80 w-80 overflow-y-auto p-3 dark:border-white/20"
			>
				<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
					Participants
				</p>

				{loading && participants.length === 0 ? (
					<p className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
						Loading…
					</p>
				) : error && participants.length === 0 ? (
					<p className="py-3 text-center text-sm text-red-500 dark:text-red-400">
						{error}
					</p>
				) : participants.length === 0 ? (
					<p className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">
						No one has joined yet
					</p>
				) : (
					<ul className="space-y-2">
						{participants.map(row => {
							const remainingSeconds = getBidRemainingSeconds(
								row.updatedAt,
								nowNyNaiveMs,
							);
							const hasActiveTimer =
								remainingSeconds != null && remainingSeconds > 0;
							const isExpired =
								remainingSeconds != null && remainingSeconds <= 0;

							return (
								<li
									key={row.userId}
									className="flex items-center justify-between gap-3 rounded-lg px-1 py-1"
								>
									<div className="flex min-w-0 flex-1 items-center gap-2">
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
											"h-8 w-8",
										)}
										<span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
											{formatParticipantName(row)}
										</span>
									</div>
									{hasActiveTimer ? (
										<span
											className="inline-flex shrink-0 min-w-[78px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
											style={{
												backgroundColor: getBidTimerBackgroundColor(
													remainingSeconds,
												),
											}}
										>
											{formatBidCountdown(remainingSeconds)}
										</span>
									) : isExpired ? (
										<span className="shrink-0 text-xs text-gray-800 dark:text-gray-200">
											Bid time Expired
										</span>
									) : (
										<span className="shrink-0 text-xs text-gray-400">—</span>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</Dropdown>
		</div>
	);
}
