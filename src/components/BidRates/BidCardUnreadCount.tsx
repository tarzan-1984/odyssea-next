"use client";

import { BidUnreadMessagesIcon } from "@/icons";
import { useChatStore } from "@/stores/chatStore";

type BidCardUnreadCountProps = {
	chatId: string | null | undefined;
};

export default function BidCardUnreadCount({ chatId }: BidCardUnreadCountProps) {
	const unreadCount = useChatStore(state => {
		if (!chatId) return 0;
		const room = state.chatRooms.find(r => r.id === chatId);
		return Math.max(0, room?.unreadCount ?? 0);
	});

	if (!chatId || unreadCount <= 0) return null;

	return (
		<span
			className="inline-flex items-center gap-1.5"
			title={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
			aria-label={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
		>
			<BidUnreadMessagesIcon className="h-5 w-5 shrink-0 text-brand-600 dark:text-white" />
			<span className="text-sm font-semibold tabular-nums text-red-500">
				{unreadCount > 99 ? "99+" : unreadCount}
			</span>
		</span>
	);
}
