"use client";

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
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

	useEffect(() => {
		if (!enabled) return;
		const intervalId = window.setInterval(() => {
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [enabled]);

	useEffect(() => {
		if (!enabled || !chatRoomId) {
			setBidRateId(null);
			setOwnerId(null);
			setByUserId({});
			return;
		}

		let cancelled = false;

		const loadParticipants = () => {
			getBidParticipantsByChat(chatRoomId)
				.then(result => {
					if (cancelled) return;
					setBidRateId(result.bidRateId);
					setOwnerId(result.ownerId ?? null);
					const next: Record<string, ParticipantTimer> = {};
					for (const row of result.participants ?? []) {
						next[row.userId] = {
							userId: row.userId,
							createdAt: toUnixNumber(row.createdAt),
							updatedAt: toUnixNumber(row.updatedAt),
						};
					}
					setByUserId(next);
				})
				.catch(error => {
					console.error("Failed to load bid auction participants:", error);
				});
		};

		loadParticipants();

		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			if (detail?.chatRoomId && detail.chatRoomId !== chatRoomId) return;
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
	}, [enabled, chatRoomId]);

	const getParticipant = useCallback(
		(userId: string) => byUserId[userId] ?? null,
		[byUserId],
	);

	const upsertParticipant = useCallback((participant: BidAuctionParticipant) => {
		setByUserId(prev => ({
			...prev,
			[participant.userId]: {
				userId: participant.userId,
				createdAt: toUnixNumber(participant.createdAt),
				updatedAt: toUnixNumber(participant.updatedAt),
			},
		}));
	}, []);

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
