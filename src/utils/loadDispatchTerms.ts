/** Driver confirmation sent after accepting LOAD dispatch terms. */
export const LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT =
	"I have read and accepted the shipment terms.";

export const LOAD_DISPATCH_TERMS_ACCEPT_BUTTON_LABEL = "Accept shipment terms";

/** First page size used by chat message loaders. */
const LOAD_CHAT_PAGE_SIZE = 50;

/** Same cutoff as phone OTP login: store 2.3.6 and missing version stay on the old chat. */
const LOAD_DISPATCH_TERMS_MIN_VERSION: [number, number, number] = [2, 3, 7];

function parseAppVersion(
	appVersion?: string | null
): [number, number, number] | null {
	const raw = appVersion?.trim();
	if (!raw) {
		return null;
	}

	const match = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
	if (!match) {
		return null;
	}

	return [
		Number(match[1]),
		Number(match[2] || 0),
		Number(match[3] || 0)
	];
}

function compareAppVersion(
	left: [number, number, number],
	right: [number, number, number]
): number {
	for (let i = 0; i < 3; i += 1) {
		if (left[i] !== right[i]) {
			return left[i] - right[i];
		}
	}
	return 0;
}

export function supportsLoadDispatchTermsAcceptance(
	appVersion?: string | null
): boolean {
	const parsed = parseAppVersion(appVersion);
	if (!parsed) {
		return false;
	}
	return compareAppVersion(parsed, LOAD_DISPATCH_TERMS_MIN_VERSION) >= 0;
}

export function isLoadDispatchTermsAcceptedMessage(
	content: string | null | undefined
): boolean {
	return (content?.trim() ?? "") === LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT;
}

type DispatchTermsMessage = {
	senderId?: string;
	isSystemMessage?: boolean;
};

/**
 * Driver must accept dispatch terms before chatting in a newly created LOAD room
 * that has a system dispatch message and no messages from this driver yet.
 * Only app 2.3.7+; a missing version keeps the legacy open chat.
 */
export function driverNeedsLoadDispatchTermsAcceptance(options: {
	isDriver: boolean;
	chatType?: string | null;
	currentUserId?: string | null;
	appVersion?: string | null;
	messages: DispatchTermsMessage[];
	hasMoreMessages?: boolean;
}): boolean {
	const {
		isDriver,
		chatType,
		currentUserId,
		appVersion,
		messages,
		hasMoreMessages = false
	} = options;
	if (!supportsLoadDispatchTermsAcceptance(appVersion)) return false;
	if (!isDriver || !currentUserId) return false;
	if ((chatType || "").trim().toUpperCase() !== "LOAD") return false;

	const hasDispatchSystemMessage = messages.some(message => message.isSystemMessage);
	if (!hasDispatchSystemMessage) return false;

	const driverHasSentMessage = messages.some(
		message => !message.isSystemMessage && message.senderId === currentUserId
	);
	if (driverHasSentMessage) return false;

	// A full first page plus older history means this is not a newly created empty chat.
	if (hasMoreMessages && messages.length >= LOAD_CHAT_PAGE_SIZE) return false;

	return true;
}
