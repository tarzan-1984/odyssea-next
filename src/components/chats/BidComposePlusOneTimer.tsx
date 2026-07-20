"use client";

import { ExtendBidTimeIcon } from "@/icons";
import {
	BID_WARNING_SECONDS,
	canExtendBidParticipantTime,
	formatBidCountdown,
	getBidParticipantRemainingSeconds,
	getBidTimerBackgroundColor,
} from "@/utils/bidTimer";
import { useBidChatAuctionOptional } from "./BidChatAuctionContext";
import { useCurrentUser } from "@/stores/userStore";

/**
 * Compact duplicate of the participant's active +1 timer next to the compose send button.
 * In the last 3 minutes (when extend is still allowed) shows Extend instead of the countdown.
 */
export default function BidComposePlusOneTimer() {
	const auction = useBidChatAuctionOptional();
	const currentUser = useCurrentUser();
	const userId = currentUser?.id;

	if (!auction || !userId) return null;

	const participant = auction.getParticipant(userId);
	if (!participant) return null;

	const remainingSeconds = getBidParticipantRemainingSeconds(
		participant.updatedAt,
		auction.nowUnixSec,
	);
	if (remainingSeconds == null || remainingSeconds <= 0) return null;

	const canExtend =
		remainingSeconds <= BID_WARNING_SECONDS &&
		canExtendBidParticipantTime(participant.createdAt, participant.updatedAt);
	const isExtending = auction.extendingUserId === userId;

	if (canExtend) {
		return (
			<button
				type="button"
				title="Extend bid time"
				aria-label="Extend bid time"
				disabled={isExtending}
				onClick={() => {
					auction.extendParticipant(userId).catch(error => {
						console.error("Failed to extend participant timer:", error);
					});
				}}
				className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
			>
				<ExtendBidTimeIcon className="h-4 w-4" aria-hidden />
				{isExtending ? "…" : "Extend"}
			</button>
		);
	}

	return (
		<span
			className="inline-flex min-w-[78px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
			style={{
				backgroundColor: getBidTimerBackgroundColor(remainingSeconds),
			}}
			title="Your +1 timer"
			aria-label={`+1 timer ${formatBidCountdown(remainingSeconds)}`}
		>
			{formatBidCountdown(remainingSeconds)}
		</span>
	);
}
