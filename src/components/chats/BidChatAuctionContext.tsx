"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	extendBidParticipantTimeByChat,
	getBidParticipantsByChat,
	type BidAuctionParticipant,
} from "@/app-api/bidRates";
import { getNowUnixSeconds } from "@/utils/bidTimer";
import {
	ODYSSEA_BID_RATE_UPDATED_EVENT,
	isBidRateRemovedReason,
	type BidRateUpdatedEventDetail,
} from "@/lib/bidRateRealtimeEvents";

type ParticipantTimer = {
	userId: string;
	/** Unix timestamp in seconds. */
	createdAt: number;
	/** Unix timestamp in seconds. */
	updatedAt: number;
};

type BidChatAuctionContextValue = {
	chatRoomId: string | null;
	bidRateId: number | null;
	ownerId: string | null;
	nowUnixSec: number;
	getParticipant: (userId: string) => ParticipantTimer | null;
	upsertParticipant: (participant: BidAuctionParticipant) => void;
	extendParticipant: (userId: string) => Promise<void>;
	extendingUserId: string | null;
};

const BidChatAuctionContext = createContext<BidChatAuctionContextValue | null>(
	null,
);

function toUnixNumber(value: number | string): number {
	return typeof value === "number" ? value : Number(value);
}

function isParticipantPayload(
	value: BidRateUpdatedEventDetail["participant"],
): value is { userId: string; createdAt: number; updatedAt: number } {
	if (!value || typeof value !== "object") return false;
	return (
		typeof value.userId === "string" &&
		Number.isFinite(Number(value.createdAt)) &&
		Number.isFinite(Number(value.updatedAt))
	);
}

export function BidChatAuctionProvider({
	chatRoomId,
	enabled,
	children,
}: {
	chatRoomId?: string | null;
	enabled: boolean;
	children: React.ReactNode;
}) {
	const [bidRateId, setBidRateId] = useState<number | null>(null);
	const [ownerId, setOwnerId] = useState<string | null>(null);
	const [byUserId, setByUserId] = useState<Record<string, ParticipantTimer>>(
		{},
	);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());
	const [extendingUserId, setExtendingUserId] = useState<string | null>(null);
	const bidRateIdRef = useRef<number | null>(null);
	const loadSeqRef = useRef(0);

	useEffect(() => {
		bidRateIdRef.current = bidRateId;
	}, [bidRateId]);

	useEffect(() => {
		if (!enabled) return;
		const intervalId = window.setInterval(() => {
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [enabled]);

	const upsertParticipant = useCallback((participant: BidAuctionParticipant) => {
		const createdAt = toUnixNumber(participant.createdAt);
		const updatedAt = toUnixNumber(participant.updatedAt);
		if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return;

		setByUserId(prev => {
			const existing = prev[participant.userId];
			// Ignore stale WS/refetch payloads that would rewind the timer.
			if (existing && existing.updatedAt > updatedAt) {
				return prev;
			}
			return {
				...prev,
				[participant.userId]: {
					userId: participant.userId,
					createdAt,
					updatedAt,
				},
			};
		});
	}, []);

	useEffect(() => {
		if (!enabled || !chatRoomId) {
			setBidRateId(null);
			setOwnerId(null);
			setByUserId({});
			return;
		}

		let cancelled = false;

		const loadParticipants = () => {
			const seq = ++loadSeqRef.current;
			getBidParticipantsByChat(chatRoomId)
				.then(result => {
					if (cancelled || seq !== loadSeqRef.current) return;
					setBidRateId(result.bidRateId);
					setOwnerId(result.ownerId ?? null);
					setByUserId(prev => {
						const next: Record<string, ParticipantTimer> = {};
						for (const row of result.participants ?? []) {
							const createdAt = toUnixNumber(row.createdAt);
							const updatedAt = toUnixNumber(row.updatedAt);
							const existing = prev[row.userId];
							next[row.userId] = {
								userId: row.userId,
								createdAt,
								updatedAt:
									existing && existing.updatedAt > updatedAt
										? existing.updatedAt
										: updatedAt,
							};
						}
						return next;
					});
				})
				.catch(error => {
					console.error("Failed to load bid auction participants:", error);
				});
		};

		loadParticipants();

		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			if (detail?.chatRoomId && detail.chatRoomId !== chatRoomId) return;
			if (
				detail?.bidRateId != null &&
				bidRateIdRef.current != null &&
				detail.bidRateId !== bidRateIdRef.current
			) {
				return;
			}
			if (isBidRateRemovedReason(detail?.reason)) {
				setByUserId({});
				return;
			}
			// Apply timer immediately from WS payload (extend/join/rejoin).
			if (isParticipantPayload(detail?.participant)) {
				upsertParticipant(detail.participant);
			}
			loadParticipants();
		};

		window.addEventListener(ODYSSEA_BID_RATE_UPDATED_EVENT, onBidRateUpdated);

		return () => {
			cancelled = true;
			window.removeEventListener(
				ODYSSEA_BID_RATE_UPDATED_EVENT,
				onBidRateUpdated,
			);
		};
	}, [enabled, chatRoomId, upsertParticipant]);

	const getParticipant = useCallback(
		(userId: string) => byUserId[userId] ?? null,
		[byUserId],
	);

	const extendParticipant = useCallback(
		async (userId: string) => {
			if (!chatRoomId) return;
			setExtendingUserId(userId);
			try {
				const result = await extendBidParticipantTimeByChat(chatRoomId, userId);
				upsertParticipant(result.participant);
			} finally {
				setExtendingUserId(null);
			}
		},
		[chatRoomId, upsertParticipant],
	);

	const value = useMemo<BidChatAuctionContextValue>(
		() => ({
			chatRoomId: chatRoomId ?? null,
			bidRateId,
			ownerId,
			nowUnixSec,
			getParticipant,
			upsertParticipant,
			extendParticipant,
			extendingUserId,
		}),
		[
			chatRoomId,
			bidRateId,
			ownerId,
			nowUnixSec,
			getParticipant,
			upsertParticipant,
			extendParticipant,
			extendingUserId,
		],
	);

	if (!enabled) {
		return <>{children}</>;
	}

	return (
		<BidChatAuctionContext.Provider value={value}>
			{children}
		</BidChatAuctionContext.Provider>
	);
}

export function useBidChatAuctionOptional(): BidChatAuctionContextValue | null {
	return useContext(BidChatAuctionContext);
}
