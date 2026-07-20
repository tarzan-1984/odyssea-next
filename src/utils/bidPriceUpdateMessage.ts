/** Detect automated BID price / offer vote messages. */
const BID_RATE_CHANGED_RE = /^Rate changed to \$/;
const BID_NEW_OFFER_RE = /^New offer: \$/;
const BID_OFFER_CONFIRMED_RE = /^Confirmed offer from /;
const BID_OFFER_REJECTED_RE = /^Rejected offer from /;
const BID_PRICE_AMOUNT_RE =
	/^(New offer: |Rate changed to |Confirmed offer from .+?: |Rejected offer from .+?: )(\$[\d,]+(?:\.\d+)?)/;

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

export function isBidOfferConfirmedMessage(
	content: string | null | undefined,
): boolean {
	const text = content?.trim() ?? "";
	return Boolean(text) && BID_OFFER_CONFIRMED_RE.test(text);
}

export function isBidOfferRejectedMessage(
	content: string | null | undefined,
): boolean {
	const text = content?.trim() ?? "";
	return Boolean(text) && BID_OFFER_REJECTED_RE.test(text);
}

export function isBidPriceUpdateMessage(
	content: string | null | undefined,
): boolean {
	return (
		isBidRateChangedMessage(content) ||
		isBidNewOfferMessage(content) ||
		isBidOfferConfirmedMessage(content) ||
		isBidOfferRejectedMessage(content)
	);
}

/** Wrap the dollar amount in markdown bold so it can be styled separately. */
export function formatBidPriceUpdateMarkdown(content: string): string {
	return content.replace(BID_PRICE_AMOUNT_RE, "$1**$2**");
}
