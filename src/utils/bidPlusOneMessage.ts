/** Stored message content for BID "+1" sticker messages. */
export const BID_PLUS_ONE_MESSAGE_CONTENT = "[[BID_PLUS_ONE]]";

export function isBidPlusOneMessage(content: string | null | undefined): boolean {
	return content?.trim() === BID_PLUS_ONE_MESSAGE_CONTENT;
}
