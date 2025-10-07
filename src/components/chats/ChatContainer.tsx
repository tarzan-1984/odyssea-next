"use client";

import React, { useState } from "react";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";
import AddNewRoomModal from "./AddNewRoomModal";
import ContactsModal from "./ContactsModal";
import { ChatRoom } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useChatModal } from "@/context/ChatModalContext";
import { useChatStore } from "@/stores/chatStore";

export default function ChatContainer() {
    const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(null);
	// Initialize WebSocket chat sync at the container level
	const webSocketChatSync = useWebSocketChatSync();
	// Get modal states
	const { isAddRoomModalOpen, closeAddRoomModal, isContactsModalOpen, closeContactsModal } = useChatModal();
    const selectedChatRoom = useChatStore(state => state.chatRooms.find(r => r.id === selectedChatRoomId));

    const handleChatSelect = (chatRoom: ChatRoom) => {
        setSelectedChatRoomId(chatRoom.id);
		// Also set in the store for WebSocket functionality
		webSocketChatSync.setCurrentChatRoom(chatRoom);
		// Note: WebSocket room joining is handled automatically by useWebSocketMessages
	};

	return (
		<>
			<div className="flex flex-col h-full gap-6 xl:flex-row xl:gap-5">
				{/* Left Sidebar - Chat List */}
				<div className="flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:flex xl:w-1/4">
					<ChatList
						onChatSelect={handleChatSelect}
                        selectedChatId={selectedChatRoomId || undefined}
						webSocketChatSync={webSocketChatSync}
					/>
				</div>

				{/* Right Side - Chat Box */}
                <ChatBox selectedChatRoomId={selectedChatRoomId || undefined} webSocketChatSync={webSocketChatSync} />
			</div>

			{/* Modals */}
			<AddNewRoomModal isOpen={isAddRoomModalOpen} onClose={closeAddRoomModal} />
			<ContactsModal isOpen={isContactsModalOpen} onClose={closeContactsModal} />
		</>
	);
}
