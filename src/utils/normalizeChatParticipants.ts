import type { ChatRoom } from "@/app-api/chatApi";
import { mergeDispatchTermsAcceptedFlag } from "@/utils/loadDispatchTerms";

type RawChatParticipant = {
	hideParticipant?: boolean;
	userId?: string;
	user?: {
		id?: string;
		firstName?: string;
		lastName?: string;
		avatar?: string;
		profilePhoto?: string;
		role?: string;
		userColor?: string | null;
		externalId?: string | null;
		phone?: string | null;
	};
};

/** Keep participant fields needed for LOAD chat search (phone, externalId). */
export function normalizeChatParticipants(participants: unknown): ChatRoom["participants"] {
	if (!Array.isArray(participants)) return [];

	return participants.map((participant) => {
		const p = participant as RawChatParticipant;
		return {
			...p,
			hideParticipant: p.hideParticipant === true,
			user: {
				id: p.user?.id,
				firstName: p.user?.firstName,
				lastName: p.user?.lastName,
				avatar: p.user?.profilePhoto ?? p.user?.avatar ?? "",
				profilePhoto: p.user?.profilePhoto,
				role: p.user?.role ?? "USER",
				userColor: p.user?.userColor ?? null,
				externalId: p.user?.externalId ?? null,
				phone: p.user?.phone ?? null,
			},
		};
	}) as ChatRoom["participants"];
}

/** Preserve list fields when single-room API omits them. */
export function mergeChatRoomParticipants(
	incoming: unknown,
	existing: ChatRoom["participants"] | undefined,
	chatRoomId?: string | null
): ChatRoom["participants"] {
	const normalizedIncoming = normalizeChatParticipants(incoming);
	if (!existing?.length) return normalizedIncoming;

	const existingByUserId = new Map<string, ChatRoom["participants"][number]>();
	for (const participant of existing) {
		const userId = participant.user?.id || participant.userId;
		if (userId) existingByUserId.set(userId, participant);
	}

	const merged = normalizedIncoming.map(incomingParticipant => {
		const userId = incomingParticipant.user?.id || incomingParticipant.userId;
		const previous = userId ? existingByUserId.get(userId) : undefined;
		if (!previous) return incomingParticipant;

		return {
			...previous,
			...incomingParticipant,
			hideParticipant: incomingParticipant.hideParticipant ?? previous.hideParticipant,
			dispatchTermsAccepted: mergeDispatchTermsAcceptedFlag(
				previous.dispatchTermsAccepted,
				incomingParticipant.dispatchTermsAccepted,
				{
					chatRoomId,
					userId: userId ?? null,
				}
			),
			user: {
				...previous.user,
				...incomingParticipant.user,
				externalId:
					incomingParticipant.user.externalId ?? previous.user.externalId ?? null,
				phone: incomingParticipant.user.phone ?? previous.user.phone ?? null,
				userColor:
					incomingParticipant.user.userColor ?? previous.user.userColor ?? null,
				avatar:
					incomingParticipant.user.avatar ||
					previous.user.avatar ||
					incomingParticipant.user.profilePhoto ||
					previous.user.profilePhoto ||
					"",
				profilePhoto:
					incomingParticipant.user.profilePhoto ?? previous.user.profilePhoto,
			},
		};
	});

	const mergedUserIds = new Set(
		merged.map(p => p.user?.id || p.userId).filter(Boolean)
	);
	for (const participant of existing) {
		const userId = participant.user?.id || participant.userId;
		if (userId && !mergedUserIds.has(userId)) {
			merged.push(participant);
		}
	}

	return merged;
}
