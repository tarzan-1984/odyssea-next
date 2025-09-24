"use client";

import React, { useState } from "react";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";
import { ChatRoom } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";

export default function ChatContainer() {
	const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoom | undefined>();
	// Initialize WebSocket chat sync at the container level
	const webSocketChatSync = useWebSocketChatSync();

	const handleChatSelect = (chatRoom: ChatRoom) => {
		setSelectedChatRoom(chatRoom);
		// Also set in the store for WebSocket functionality
		webSocketChatSync.setCurrentChatRoom(chatRoom);
		// Note: WebSocket room joining is handled automatically by useWebSocketMessages
	};

	return (
		<div className="flex flex-col h-full gap-6 xl:flex-row xl:gap-5">
			{/* Left Sidebar - Chat List */}
			<div className="flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:flex xl:w-1/4">
				<ChatList
					onChatSelect={handleChatSelect}
					selectedChatId={selectedChatRoom?.id}
					webSocketChatSync={webSocketChatSync}
				/>
			</div>

			{/* Right Side - Chat Box */}
			<ChatBox selectedChatRoom={selectedChatRoom} webSocketChatSync={webSocketChatSync} />
		</div>
	);
}
