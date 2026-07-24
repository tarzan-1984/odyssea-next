"use client";

import { useCallback, useEffect, useState } from "react";
import { EditOfferIcon } from "@/icons";
import { getBidParticipants, type BidRate } from "@/app-api/bidRates";
import {
	getBidParticipantRemainingSeconds,
	getNowUnixSeconds,
} from "@/utils/bidTimer";
import {
	useBidRateOffersGate,
	BID_MAX_ACTIVE_OFFERS,
	userHasActiveBidRateOffer,
	countActiveBidRateOffers,
	fetchVotersCached,
} from "./BidRateVotersPopup";
import {
	ODYSSEA_BID_RATE_UPDATED_EVENT,
	isBidRateRemovedReason,
	type BidRateUpdatedEventDetail,
} from "@/lib/bidRateRealtimeEvents";

type BidEditPriceButtonProps = {
	bid: BidRate;
	currentUserId: string | null | undefined;
	onEdit: (bid: BidRate) => void;
};

export default function BidEditPriceButton({
	bid,
	currentUserId,
	onEdit,
}: BidEditPriceButtonProps) {
	const isOwner = Boolean(
		currentUserId && bid.ownerId && currentUserId === bid.ownerId,
	);
	/** Gate + participants only matter for non-owners placing offers. */
	const [gateEnabled, setGateEnabled] = useState(false);
	const { offerLocked, offersAtLimit } = useBidRateOffersGate(
		bid.id,
		currentUserId,
		{ enabled: !isOwner && gateEnabled },
	);
	const [plusOneActive, setPlusOneActive] = useState(isOwner);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());
	const [plusOneUpdatedAt, setPlusOneUpdatedAt] = useState<number | null>(null);
	const [plusOneLoaded, setPlusOneLoaded] = useState(isOwner);
	const [checkingGate, setCheckingGate] = useState(false);

	const refreshPlusOne = useCallback(async () => {
		if (!currentUserId || isOwner) {
			setPlusOneActive(true);
			setPlusOneUpdatedAt(null);
			setPlusOneLoaded(true);
			return true;
		}
		try {
			const result = await getBidParticipants(bid.id);
			const mine = (result.participants ?? []).find(
				row => row.userId === currentUserId,
			);
			if (!mine) {
				setPlusOneActive(false);
				setPlusOneUpdatedAt(null);
				setPlusOneLoaded(true);
				return false;
			}
			const updatedAt = Number(mine.updatedAt);
			setPlusOneUpdatedAt(Number.isFinite(updatedAt) ? updatedAt : null);
			const remaining = getBidParticipantRemainingSeconds(
				updatedAt,
				getNowUnixSeconds(),
			);
			const active = remaining != null && remaining > 0;
			setPlusOneActive(active);
			setPlusOneLoaded(true);
			return active;
		} catch {
			setPlusOneActive(false);
			setPlusOneUpdatedAt(null);
			setPlusOneLoaded(true);
			return false;
		}
	}, [bid.id, currentUserId, isOwner]);

	const ensureGateData = useCallback(() => {
		if (isOwner) return;
		setGateEnabled(true);
		if (!plusOneLoaded) {
			refreshPlusOne().catch(() => undefined);
		}
	}, [isOwner, plusOneLoaded, refreshPlusOne]);

	useEffect(() => {
		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			const matchesById =
				detail?.bidRateId != null && detail.bidRateId === bid.id;
			const matchesByChat =
				detail?.chatRoomId != null &&
				bid.chatId != null &&
				detail.chatRoomId === bid.chatId;
			if (detail?.bidRateId != null && detail.bidRateId !== bid.id) return;
			if (
				detail?.chatRoomId != null &&
				bid.chatId != null &&
				detail.chatRoomId !== bid.chatId &&
				!matchesById
			) {
				return;
			}
			if (isBidRateRemovedReason(detail?.reason)) {
				setPlusOneActive(false);
				setPlusOneUpdatedAt(null);
				return;
			}
			// Optimistic / WS join payload: unlock edit immediately without waiting for refetch.
			const participant = detail?.participant;
			if (
				!isOwner &&
				currentUserId &&
				participant &&
				participant.userId === currentUserId &&
				(matchesById || matchesByChat)
			) {
				const updatedAt = Number(participant.updatedAt);
				if (Number.isFinite(updatedAt)) {
					setPlusOneUpdatedAt(prev =>
						prev != null && prev > updatedAt ? prev : updatedAt,
					);
					const remaining = getBidParticipantRemainingSeconds(
						updatedAt,
						getNowUnixSeconds(),
					);
					if (remaining != null && remaining > 0) {
						setPlusOneActive(true);
						setPlusOneLoaded(true);
						return;
					}
				}
			}
			if (gateEnabled || plusOneLoaded) {
				refreshPlusOne().catch(() => undefined);
			}
		};
		window.addEventListener(ODYSSEA_BID_RATE_UPDATED_EVENT, onBidRateUpdated);
		return () => {
			window.removeEventListener(
				ODYSSEA_BID_RATE_UPDATED_EVENT,
				onBidRateUpdated,
			);
		};
	}, [
		bid.chatId,
		bid.id,
		currentUserId,
		gateEnabled,
		isOwner,
		plusOneLoaded,
		refreshPlusOne,
	]);

	useEffect(() => {
		if (isOwner || plusOneUpdatedAt == null) return;
		const remaining = getBidParticipantRemainingSeconds(
			plusOneUpdatedAt,
			nowUnixSec,
		);
		const active = remaining != null && remaining > 0;
		setPlusOneActive(active);
		if (!active) return;
		const intervalId = window.setInterval(() => {
			setNowUnixSec(getNowUnixSeconds());
		}, 1000);
		return () => window.clearInterval(intervalId);
	}, [isOwner, plusOneUpdatedAt, nowUnixSec]);

	const blockedByPlusOne = !isOwner && plusOneLoaded && !plusOneActive;
	const disabled =
		!isOwner &&
		(offerLocked || blockedByPlusOne || offersAtLimit || checkingGate);

	let title = "Edit price";
	if (checkingGate) {
		title = "Checking offer status…";
	} else if (offerLocked) {
		title = "You already have an active offer. Wait until the timer expires.";
	} else if (offersAtLimit) {
		title = `Maximum of ${BID_MAX_ACTIVE_OFFERS} active offers. Wait until one expires or is resolved.`;
	} else if (blockedByPlusOne) {
		title = "Press +1 and keep an active timer before placing an offer.";
	}

	async function handleEditClick() {
		if (isOwner) {
			onEdit(bid);
			return;
		}
		setCheckingGate(true);
		setGateEnabled(true);
		try {
			const [voters, plusOneOk] = await Promise.all([
				fetchVotersCached(bid.id),
				refreshPlusOne(),
			]);
			const now = getNowUnixSeconds();
			const locked = userHasActiveBidRateOffer(voters, currentUserId, now);
			const atLimit =
				countActiveBidRateOffers(voters, now) >= BID_MAX_ACTIVE_OFFERS;
			if (locked || atLimit || !plusOneOk) return;
			onEdit(bid);
		} finally {
			setCheckingGate(false);
		}
	}

	return (
		<button
			type="button"
			title={title}
			aria-label={disabled ? title : "Edit price"}
			disabled={disabled}
			onMouseEnter={ensureGateData}
			onFocus={ensureGateData}
			onClick={e => {
				e.stopPropagation();
				if (disabled) return;
				handleEditClick().catch(() => undefined);
			}}
			className={
				disabled
					? "inline-flex h-7 w-7 shrink-0 cursor-not-allowed items-center justify-center rounded text-gray-400 opacity-50 dark:text-gray-500"
					: "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-brand-600 hover:opacity-80 dark:text-brand-400"
			}
		>
			<EditOfferIcon className="h-6 w-6" aria-hidden />
		</button>
	);
}
