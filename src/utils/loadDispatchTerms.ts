/** Driver confirmation sent after accepting LOAD dispatch terms. */
export const LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT =
	"I have read and accepted the shipment terms.";

export const LOAD_DISPATCH_TERMS_ACCEPT_BUTTON_LABEL = "Accept shipment terms";

/** First page size used by chat message loaders. */
const LOAD_CHAT_PAGE_SIZE = 50;

/** Same cutoff as phone OTP login: store 2.3.6 and missing version stay on the old chat. */
const LOAD_DISPATCH_TERMS_MIN_VERSION: [number, number, number] = [2, 3, 7];

const LOAD_DISPATCH_SYSTEM_KIND = "load_dispatch";
const LOAD_PROXIMITY_SYSTEM_KIND = "load_proximity";

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

export type DispatchTermsMessage = {
	senderId?: string;
	isSystemMessage?: boolean;
	systemMessageKind?: string | null;
};

/**
 * Only the LOAD dispatch system bubble requires terms acceptance.
 * Proximity alerts are also system messages and must not open the Accept gate.
 * Legacy dispatch rows may have isSystemMessage without a kind.
 */
export function isLoadDispatchTermsSystemMessage(
	message: DispatchTermsMessage
): boolean {
	if (!message.isSystemMessage) return false;
	if (message.systemMessageKind === LOAD_PROXIMITY_SYSTEM_KIND) return false;
	if (!message.systemMessageKind) return true;
	return message.systemMessageKind === LOAD_DISPATCH_SYSTEM_KIND;
}

export type LoadDispatchTermsUiState = {
	hideComposer: boolean;
	showAcceptButton: boolean;
};

/**
 * Driver must accept dispatch terms before chatting in a newly created LOAD room
 * that has a system dispatch message and no messages from this driver yet.
 * Only app 2.3.7+ unless skipAppVersionCheck (web). A missing version keeps the
 * legacy open chat.
 */
export function getLoadDispatchTermsUiState(options: {
	isDriver: boolean;
	chatType?: string | null;
	currentUserId?: string | null;
	appVersion?: string | null;
	skipAppVersionCheck?: boolean;
	messages: DispatchTermsMessage[];
	hasMoreMessages?: boolean;
	messagesReady?: boolean;
}): LoadDispatchTermsUiState {
	const {
		isDriver,
		chatType,
		currentUserId,
		appVersion,
		skipAppVersionCheck = false,
		messages,
		hasMoreMessages = false,
		messagesReady = true
	} = options;

	const inactive: LoadDispatchTermsUiState = {
		hideComposer: false,
		showAcceptButton: false
	};

	if (!skipAppVersionCheck && !supportsLoadDispatchTermsAcceptance(appVersion)) {
		return inactive;
	}
	if (!isDriver || !currentUserId) return inactive;
	if ((chatType || "").trim().toUpperCase() !== "LOAD") return inactive;

	const driverHasSentMessage = messages.some(
		message => !message.isSystemMessage && message.senderId === currentUserId
	);
	if (driverHasSentMessage) return inactive;

	const hasDispatchSystemMessage = messages.some(isLoadDispatchTermsSystemMessage);

	if (!messagesReady) {
		return {
			hideComposer: true,
			showAcceptButton: hasDispatchSystemMessage
		};
	}

	if (!hasDispatchSystemMessage) return inactive;

	// A full first page plus older history means this is not a newly created empty chat.
	if (hasMoreMessages && messages.length >= LOAD_CHAT_PAGE_SIZE) return inactive;

	return { hideComposer: true, showAcceptButton: true };
}

export function driverNeedsLoadDispatchTermsAcceptance(options: {
	isDriver: boolean;
	chatType?: string | null;
	currentUserId?: string | null;
	appVersion?: string | null;
	skipAppVersionCheck?: boolean;
	messages: DispatchTermsMessage[];
	hasMoreMessages?: boolean;
	messagesReady?: boolean;
}): boolean {
	return getLoadDispatchTermsUiState(options).showAcceptButton;
}
