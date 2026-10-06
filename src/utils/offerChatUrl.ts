import type { ChatRoom } from "@/app-api/chatApi";

export function getOfferIdFromChatRoom(chatRoom: ChatRoom): string | null {
	if (chatRoom.offerId) return String(chatRoom.offerId).trim();
	if ((chatRoom.type || "").toUpperCase().trim() !== "OFFER" || !chatRoom.name) return null;
	const match = chatRoom.name.match(/\(id:\s*([^)]+)\)/);
	return match ? match[1].trim() : null;
}

/** Driver externalId for the OFFER chat (the non-current participant). */
export function getOfferDriverUnitId(
	chatRoom: ChatRoom,
	currentUserId?: string | null
): string | null {
	const otherParticipants = chatRoom.participants.filter(
		p => p.user.id !== currentUserId
	);
	const driverParticipant =
		otherParticipants.find(p => (p.user.role || "").toUpperCase().trim() === "DRIVER") ??
		otherParticipants[0];
	const externalId = driverParticipant?.user.externalId?.trim();
	return externalId || null;
}

export function findOfferChatRoom(
	chatRooms: ChatRoom[],
	offerId: string,
	unitId?: string | null,
	currentUserId?: string | null
): ChatRoom | undefined {
	return findOfferDriverChatRoom(chatRooms, offerId, unitId, null, currentUserId);
}

/**
 * Match an OFFER room to a driver row.
 * Live `chatRoomCreated` payloads may omit externalId, so driver user id is a fallback.
 */
export function findOfferDriverChatRoom(
	chatRooms: ChatRoom[],
	offerId: string,
	unitId?: string | null,
	driverUserId?: string | null,
	currentUserId?: string | null
): ChatRoom | undefined {
	const normalizedOfferId = offerId.trim();
	const normalizedUnitId = unitId?.trim() || null;
	const normalizedDriverUserId = driverUserId?.trim() || null;

	return chatRooms.find(room => {
		if ((room.type || "").toUpperCase().trim() !== "OFFER") return false;
		if (getOfferIdFromChatRoom(room) !== normalizedOfferId) return false;
		if (!normalizedUnitId && !normalizedDriverUserId) return true;

		const otherParticipants = room.participants.filter(
			p => p.user?.id !== currentUserId
		);
		const driverParticipant =
			otherParticipants.find(p => (p.user?.role || "").toUpperCase().trim() === "DRIVER") ??
			otherParticipants[0];
		if (!driverParticipant?.user) return false;
		if (
			normalizedUnitId &&
			(driverParticipant.user.externalId?.trim() || null) === normalizedUnitId
		) {
			return true;
		}
		if (normalizedDriverUserId && driverParticipant.user.id === normalizedDriverUserId) {
			return true;
		}
		return false;
	});
}

export function buildOfferChatUrl(offerId: string, unitId?: string | null): string {
	const params = new URLSearchParams();
	params.set("offer", offerId.trim());
	const unit = unitId?.trim();
	if (unit) params.set("unit", unit);
	return `/chat?${params.toString()}`;
}

/** Secondary load-chat tabs encoded in `/chat?tab=`. */
export type LoadChatUrlTab = "my-loads" | "my-team";

export function parseLoadChatUrlTab(value: string | null | undefined): LoadChatUrlTab | null {
	if (value === "my-loads" || value === "my-team") return value;
	return null;
}

export function buildLoadChatUrl(
	loadId: string,
	roomId?: string | null,
	tab?: LoadChatUrlTab | null
): string {
	const params = new URLSearchParams();
	params.set("load", loadId.trim());
	const room = roomId?.trim();
	if (room) params.set("room", room);
	if (tab === "my-loads" || tab === "my-team") params.set("tab", tab);
	return `/chat?${params.toString()}`;
}

/** Keep current chat query, but set or drop the My Loads / My Team tab. */
export function buildChatUrlWithLoadTab(
	searchParams: { toString(): string },
	tab: LoadChatUrlTab | null
): string {
	const params = new URLSearchParams(searchParams.toString());
	if (tab) params.set("tab", tab);
	else params.delete("tab");
	const qs = params.toString();
	return qs ? `/chat?${qs}` : "/chat";
}

/** Link metadata stored on Notification.data (backend). */
export type NotificationLinkData = {
	chatRoomId?: string;
	chatRoomType?: string;
	loadId?: string | null;
	offerId?: number | string | null;
	unitId?: string | null;
	removedSelf?: boolean;
};

const OFFER_NOTIFICATION_TYPES = new Set([
	"offer_bid",
	"offer_refused",
	"offer_extend_time",
	"offer_selected",
	"offer_added",
	"offer_updated",
	"offer_unavailable",
	"offer_counter_offer",
	"offer_custom",
]);

const CHAT_NOTIFICATION_TYPES = new Set([
	"private_chat_created",
	"group_chat_created",
	"participants_added_to_group_chat",
	"participant_removed_from_group_chat",
	"user_left_group_chat",
	"load_chat_created",
	"load_chat_participant_added",
	"load_chat_participant_removed",
]);

export function parseNotificationLinkData(raw: unknown): NotificationLinkData | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	return raw as NotificationLinkData;
}

/**
 * Resolve navigation href for an in-app notification.
 * Returns null when the item should not be clickable (e.g. you were removed from a chat).
 */
export function getNotificationHref(
	type: string,
	rawData: unknown
): string | null {
	const data = parseNotificationLinkData(rawData);

	if (data?.removedSelf) {
		return null;
	}

	if (OFFER_NOTIFICATION_TYPES.has(type)) {
		return "/offers";
	}

	if (!CHAT_NOTIFICATION_TYPES.has(type)) {
		return null;
	}

	const chatRoomId = data?.chatRoomId?.trim();
	if (!chatRoomId) {
		return null;
	}

	const chatType = (data?.chatRoomType || "").toUpperCase().trim();
	if (chatType === "LOAD") {
		const loadId = String(data?.loadId ?? "").trim();
		if (loadId) return buildLoadChatUrl(loadId, chatRoomId);
	}
	if (chatType === "OFFER") {
		const offerId = data?.offerId != null ? String(data.offerId).trim() : "";
		if (offerId) {
			return buildOfferChatUrl(offerId, data?.unitId);
		}
	}

	return `/chat?room=${encodeURIComponent(chatRoomId)}`;
}

export function buildChatUrlForRoom(
	chatRoom: ChatRoom,
	currentUserId?: string | null,
	tab?: LoadChatUrlTab | null
): string {
	const type = (chatRoom.type || "").toUpperCase().trim();
	if (type === "LOAD") {
		const loadId = String(chatRoom.loadId ?? "").trim();
		if (loadId) return buildLoadChatUrl(loadId, chatRoom.id, tab);
	}
	if (type === "OFFER") {
		const offerId = getOfferIdFromChatRoom(chatRoom);
		if (offerId) {
			const unitId = getOfferDriverUnitId(chatRoom, currentUserId);
			return buildOfferChatUrl(offerId, unitId);
		}
	}
	return `/chat?room=${encodeURIComponent(chatRoom.id)}`;
}
