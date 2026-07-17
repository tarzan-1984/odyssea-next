"use client";
import React from "react";
import { useChatRooms } from "@/stores/chatStore";

interface UnreadCountBadgeProps {
	className?: string;
	/** "non-bid" = all rooms except BID (Chat menu). "bid" = BID rooms only (Bid rates menu). */
	filter?: "non-bid" | "bid";
}

export const UnreadCountBadge: React.FC<UnreadCountBadgeProps> = ({
	className = "",
	filter = "non-bid",
}) => {
	const chatRooms = useChatRooms();

	const totalUnreadCount = chatRooms.reduce((total, chatRoom) => {
		if (filter === "bid" && chatRoom.type !== "BID") return total;
		if (filter === "non-bid" && chatRoom.type === "BID") return total;
		return total + (chatRoom.unreadCount || 0);
	}, 0);

	if (totalUnreadCount === 0) {
		return null;
	}

	return (
		<span
			className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium text-white bg-red-500 rounded-full ${className}`}
		>
			{totalUnreadCount > 99 ? "99+" : totalUnreadCount}
		</span>
	);
};
