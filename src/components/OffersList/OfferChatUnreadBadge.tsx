"use client";

import type { ChatRoom } from "@/app-api/chatApi";
import type { OfferDriver } from "@/app-api/offers";
import { useChatStore } from "@/stores/chatStore";
import { useUserStore } from "@/stores/userStore";
import { findOfferChatRoom } from "@/utils/offerChatUrl";

function offerDriverUnitId(driver: Pick<OfferDriver, "externalId" | "driver_id">): string {
	return String(driver.externalId ?? driver.driver_id ?? "").trim();
}

export function getOfferDriverChatUnreadCount(
	chatRooms: ChatRoom[],
	offerId: string,
	unitId: string | null | undefined,
	currentUserId?: string | null
): number {
	const unit = unitId?.trim();
	if (!unit) return 0;
	const room = findOfferChatRoom(chatRooms, offerId, unit, currentUserId);
	return Math.max(0, room?.unreadCount ?? 0);
}

function UnreadCountBadge({
	count,
	className,
}: {
	count: number;
	className: string;
}) {
	if (count <= 0) return null;
	const label = `${count} unread message${count === 1 ? "" : "s"}`;
	return (
		<span className={className} title={label} aria-label={label}>
			{count > 99 ? "99+" : count}
		</span>
	);
}

const INLINE_BADGE_CLASS =
	"inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900";

const CORNER_BADGE_CLASS =
	"pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900";

/** Red count on one driver's offer chat. Clears when that room's unread hits 0. */
export function OfferChatUnreadBadge({
	offerId,
	unitId,
	placement = "inline",
}: {
	offerId: number | string;
	unitId: string | null | undefined;
	placement?: "inline" | "corner";
}) {
	const currentUserId = useUserStore(state => state.currentUser?.id ?? null);
	const normalizedUnit = unitId?.trim() ?? "";
	const unreadCount = useChatStore(state =>
		getOfferDriverChatUnreadCount(
			state.chatRooms,
			String(offerId),
			normalizedUnit,
			currentUserId
		)
	);

	return (
		<UnreadCountBadge
			count={unreadCount}
			className={placement === "corner" ? CORNER_BADGE_CLASS : INLINE_BADGE_CLASS}
		/>
	);
}

/** Total unread across every driver chat on an offer card. */
export function OfferCardUnreadBadge({
	offerId,
	drivers,
}: {
	offerId: number;
	drivers: OfferDriver[] | undefined;
}) {
	const currentUserId = useUserStore(state => state.currentUser?.id ?? null);
	const unitsKey = (drivers ?? [])
		.map(offerDriverUnitId)
		.filter(Boolean)
		.join("\n");
	const unreadCount = useChatStore(state => {
		if (!unitsKey) return 0;
		let total = 0;
		for (const unitId of unitsKey.split("\n")) {
			total += getOfferDriverChatUnreadCount(
				state.chatRooms,
				String(offerId),
				unitId,
				currentUserId
			);
		}
		return total;
	});

	return <UnreadCountBadge count={unreadCount} className={INLINE_BADGE_CLASS} />;
}
