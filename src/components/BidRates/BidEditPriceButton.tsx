"use client";

import { useCallback, useEffect, useState } from "react";
import { EditOfferIcon } from "@/icons";
import { getBidParticipants, type BidRate } from "@/app-api/bidRates";
import {
	getBidParticipantRemainingSeconds,
	getNowUnixSeconds,
} from "@/utils/bidTimer";
import { useHasActiveBidRateOffer } from "./BidRateVotersPopup";
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
	const offerLocked = useHasActiveBidRateOffer(bid.id, currentUserId);
	const [plusOneActive, setPlusOneActive] = useState(isOwner);
	const [nowUnixSec, setNowUnixSec] = useState(() => getNowUnixSeconds());
	const [plusOneUpdatedAt, setPlusOneUpdatedAt] = useState<number | null>(null);

	const refreshPlusOne = useCallback(async () => {
		if (!currentUserId || isOwner) {
			setPlusOneActive(true);
			setPlusOneUpdatedAt(null);
			return;
		}
		try {
			const result = await getBidParticipants(bid.id);
			const mine = (result.participants ?? []).find(
				row => row.userId === currentUserId,
			);
			if (!mine) {
				setPlusOneActive(false);
				setPlusOneUpdatedAt(null);
				return;
			}
			const updatedAt = Number(mine.updatedAt);
			setPlusOneUpdatedAt(Number.isFinite(updatedAt) ? updatedAt : null);
			const remaining = getBidParticipantRemainingSeconds(
				updatedAt,
				getNowUnixSeconds(),
			);
			setPlusOneActive(remaining != null && remaining > 0);
		} catch {
			setPlusOneActive(false);
			setPlusOneUpdatedAt(null);
		}
	}, [bid.id, currentUserId, isOwner]);

	useEffect(() => {
		refreshPlusOne().catch(() => undefined);
	}, [refreshPlusOne]);

	useEffect(() => {
		const onBidRateUpdated = (event: Event) => {
			const detail = (event as CustomEvent<BidRateUpdatedEventDetail>).detail;
			if (detail?.bidRateId != null && detail.bidRateId !== bid.id) return;
			if (isBidRateRemovedReason(detail?.reason)) {
				setPlusOneActive(false);
				setPlusOneUpdatedAt(null);
				return;
			}
			refreshPlusOne().catch(() => undefined);
		};
		window.addEventListener(ODYSSEA_BID_RATE_UPDATED_EVENT, onBidRateUpdated);
		return () => {
			window.removeEventListener(
				ODYSSEA_BID_RATE_UPDATED_EVENT,
				onBidRateUpdated,
			);
		};
	}, [bid.id, refreshPlusOne]);

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

	const blockedByPlusOne = !isOwner && !plusOneActive;
	const disabled = offerLocked || blockedByPlusOne;

	let title = "Edit price";
	if (offerLocked) {
		title = "You already have an active offer. Wait until the timer expires.";
	} else if (blockedByPlusOne) {
		title = "Press +1 and keep an active timer before placing an offer.";
	}

	return (
		<button
			type="button"
			title={title}
			aria-label={disabled ? title : "Edit price"}
			disabled={disabled}
			onClick={e => {
				e.stopPropagation();
				if (disabled) return;
				onEdit(bid);
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
