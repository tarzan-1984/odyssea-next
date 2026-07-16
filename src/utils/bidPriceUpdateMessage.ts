/** Detect automated BID price update messages from the bid creator. */
const BID_RATE_CHANGED_RE = /^Rate changed to \$/;
const BID_NEW_OFFER_RE = /^New offer: \$/;
const BID_PRICE_AMOUNT_RE =
	/^(New offer: |Rate changed to )(\$[\d,]+(?:\.\d+)?)/;

export function isBidRateChangedMessage(
	content: string | null | undefined,
): boolean {
	const text = content?.trim() ?? "";
	return Boolean(text) && BID_RATE_CHANGED_RE.test(text);
}

export function isBidNewOfferMessage(
	content: string | null | undefined,
): boolean {
	const text = content?.trim() ?? "";
	return Boolean(text) && BID_NEW_OFFER_RE.test(text);
}

export function isBidPriceUpdateMessage(
	content: string | null | undefined,
): boolean {
	return isBidRateChangedMessage(content) || isBidNewOfferMessage(content);
}

/** Wrap the dollar amount in markdown bold so it can be styled separately. */
export function formatBidPriceUpdateMarkdown(content: string): string {
	return content.replace(BID_PRICE_AMOUNT_RE, "$1**$2**");
}
