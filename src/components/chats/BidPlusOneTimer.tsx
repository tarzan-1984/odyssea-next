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

type BidPlusOneTimerProps = {
	senderUserId: string;
	/** Show Extend for own timer or when current user may extend this participant. */
	canManage: boolean;
	isOutgoing?: boolean;
	/**
	 * Only the newest +1 message for this sender shows a live countdown.
	 * Older +1 messages always show "Bid time Expired".
	 */
	isLatestPlusOneMessage?: boolean;
};

export default function BidPlusOneTimer({
	senderUserId,
	canManage,
	isOutgoing = false,
	isLatestPlusOneMessage = true,
}: BidPlusOneTimerProps) {
	const auction = useBidChatAuctionOptional();
	if (!auction) return null;

	const participant = auction.getParticipant(senderUserId);
	if (!participant) return null;

	const expiredLabel = (
		<p
			className={
				isOutgoing
					? "mt-2 text-center text-xs font-medium text-white/90"
					: "mt-2 text-center text-xs font-medium text-gray-800 dark:text-gray-200"
			}
		>
			Bid time Expired
		</p>
	);

	if (!isLatestPlusOneMessage) {
		return expiredLabel;
	}

	const remainingSeconds = getBidParticipantRemainingSeconds(
		participant.updatedAt,
		auction.nowUnixSec,
	);
	if (remainingSeconds == null) return null;

	const hasActiveTimer = remainingSeconds > 0;
	const isExpired = remainingSeconds <= 0;
	const showExtendButton =
		canManage &&
		hasActiveTimer &&
		remainingSeconds <= BID_WARNING_SECONDS &&
		canExtendBidParticipantTime(participant.createdAt, participant.updatedAt);
	const isExtending = auction.extendingUserId === senderUserId;

	if (hasActiveTimer) {
		return (
			<div className="mt-2 flex flex-col items-center gap-1.5">
				<span
					className="inline-flex min-w-[78px] items-center justify-center rounded-full px-2 py-1 text-xs font-semibold tabular-nums text-white transition-[background-color] duration-1000"
					style={{
						backgroundColor: getBidTimerBackgroundColor(remainingSeconds),
					}}
				>
					{formatBidCountdown(remainingSeconds)}
				</span>
				{showExtendButton ? (
					<button
						type="button"
						title="Extend bid time"
						disabled={isExtending}
						onClick={() => {
							auction.extendParticipant(senderUserId).catch(error => {
								console.error("Failed to extend participant timer:", error);
							});
						}}
						className={
							isOutgoing
								? "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-white/40 bg-white/15 px-2 text-xs font-medium text-white hover:bg-white/25 disabled:opacity-50"
								: "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-brand-300 bg-brand-50 px-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 dark:border-brand-700 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
						}
					>
						<ExtendBidTimeIcon className="h-4 w-4" aria-hidden />
						{isExtending ? "…" : "Extend"}
					</button>
				) : null}
			</div>
		);
	}

	if (isExpired) {
		return expiredLabel;
	}

	return null;
}
