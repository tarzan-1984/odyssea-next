/** Driver confirmation sent after accepting LOAD dispatch terms. */
export const LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT =
	"I have read and accepted the shipment terms.";

export const LOAD_DISPATCH_TERMS_ACCEPT_BUTTON_LABEL = "Accept shipment terms";

/** Same cutoff as phone OTP login: store 2.3.6 and missing version stay on the old chat. */
const LOAD_DISPATCH_TERMS_MIN_VERSION: [number, number, number] = [2, 3, 7];

const LOAD_DISPATCH_SYSTEM_KIND = "load_dispatch";
const LOAD_PROXIMITY_SYSTEM_KIND = "load_proximity";
const LOAD_STALE_LOCATION_SYSTEM_KIND = "load_stale_location";
const DRIVER_REST_ENDED_SYSTEM_KIND = "driver_rest_ended";
const DRIVER_REST_UPDATED_SYSTEM_KIND = "driver_rest_updated";

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
	sender?: { id?: string | null } | null;
	isSystemMessage?: boolean;
	systemMessageKind?: string | null;
	/** Unsent local bubble. Must not count as an accepted or prior driver message. */
	pendingOutgoing?: unknown;
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
	if (message.systemMessageKind === LOAD_STALE_LOCATION_SYSTEM_KIND) return false;
	if (message.systemMessageKind === DRIVER_REST_ENDED_SYSTEM_KIND) return false;
	if (message.systemMessageKind === DRIVER_REST_UPDATED_SYSTEM_KIND) return false;
	if (!message.systemMessageKind) return true;
	return message.systemMessageKind === LOAD_DISPATCH_SYSTEM_KIND;
}

export type LoadDispatchTermsUiState = {
	hideComposer: boolean;
	showAcceptButton: boolean;
};

export type LoadDispatchTermsUiOptions = {
	isDriver: boolean;
	chatType?: string | null;
	currentUserId?: string | null;
	appVersion?: string | null;
	skipAppVersionCheck?: boolean;
	/**
	 * chat_room_participants.dispatch_terms_accepted for this viewer.
	 * Missing (stale cache) stays open. Only an explicit false hides the composer.
	 */
	dispatchTermsAccepted?: boolean | null;
};

type DispatchTermsParticipant = {
	userId: string;
	dispatchTermsAccepted?: boolean | null;
};

/**
 * Driver Accept gate for a LOAD chat. The participant flag is the source of truth.
 * App 2.3.7+ unless skipAppVersionCheck (web). A missing version keeps the composer.
 */
export function getLoadDispatchTermsUiState(
	options: LoadDispatchTermsUiOptions
): LoadDispatchTermsUiState {
	const {
		isDriver,
		chatType,
		currentUserId,
		appVersion,
		skipAppVersionCheck = false,
		dispatchTermsAccepted
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
	if (dispatchTermsAccepted !== false) return inactive;

	return { hideComposer: true, showAcceptButton: true };
}

export function driverNeedsLoadDispatchTermsAcceptance(
	options: LoadDispatchTermsUiOptions
): boolean {
	return getLoadDispatchTermsUiState(options).showAcceptButton;
}

/** First boolean wins. Use the live store before a room snapshot that may still be false. */
export function resolveDispatchTermsAccepted(
	sources: Array<DispatchTermsParticipant[] | undefined | null>,
	userId?: string | null
): boolean | undefined {
	if (!userId) return undefined;
	for (const participants of sources) {
		const value = participants?.find(participant => participant.userId === userId)
			?.dispatchTermsAccepted;
		if (value === true || value === false) return value;
	}
	return undefined;
}

export function markParticipantDispatchTermsAccepted<T extends DispatchTermsParticipant>(
	participants: T[] | undefined,
	userId: string
): T[] | undefined {
	if (!participants) return participants;
	return participants.map(participant =>
		participant.userId === userId
			? { ...participant, dispatchTermsAccepted: true }
			: participant
	);
}
