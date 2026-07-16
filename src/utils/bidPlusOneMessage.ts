import { parseNaiveNyDateTime } from "@/utils/nyWallClock";

/** Stored message content for BID "+1" sticker messages. */
export const BID_PLUS_ONE_MESSAGE_CONTENT = "[[BID_PLUS_ONE]]";

export function isBidPlusOneMessage(content: string | null | undefined): boolean {
	return content?.trim() === BID_PLUS_ONE_MESSAGE_CONTENT;
}

/**
 * Latest +1 message id per sender — only that message should show a live timer;
 * older +1 messages from the same user show "Bid time Expired".
 */
export function getLatestBidPlusOneMessageIdBySender(
	messages: Array<{
		id: string;
		senderId: string;
		content?: string | null;
		createdAt: string;
	}>,
): Map<string, string> {
	const latestIdBySender = new Map<string, string>();
	const latestTsBySender = new Map<string, number>();

	for (const message of messages) {
		if (!isBidPlusOneMessage(message.content)) continue;
		const parsed = parseNaiveNyDateTime(message.createdAt);
		const ts = parsed?.getTime() ?? 0;
		const prevTs = latestTsBySender.get(message.senderId);
		if (prevTs == null || ts >= prevTs) {
			latestTsBySender.set(message.senderId, ts);
			latestIdBySender.set(message.senderId, message.id);
		}
	}

	return latestIdBySender;
}
