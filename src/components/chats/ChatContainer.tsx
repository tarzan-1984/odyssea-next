"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";
import AddNewRoomModal from "./AddNewRoomModal";
import ContactsModal from "./ContactsModal";
import { ChatRoom } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useChatModal } from "@/context/ChatModalContext";
import { useChatStore } from "@/stores/chatStore";

export default function ChatContainer() {
	const searchParams = useSearchParams();
	const roomFromUrl = searchParams.get("room");
	const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(
		roomFromUrl || null
	);
	// Initialize WebSocket chat sync at the container level
	const webSocketChatSync = useWebSocketChatSync();
	const chatRooms = useChatStore(s => s.chatRooms);

	useEffect(() => {
		if (!roomFromUrl) return;

		const trySelect = async () => {
			const fromList = chatRooms.find(r => r.id === roomFromUrl);
			if (fromList) {
				setSelectedChatRoomId(roomFromUrl);
				webSocketChatSync.setCurrentChatRoom(fromList);
				return;
			}
			const curr = useChatStore.getState().currentChatRoom;
			if (curr?.id === roomFromUrl) {
				setSelectedChatRoomId(roomFromUrl);
				return;
			}
			try {
				const { chatApi } = await import("@/app-api/chatApi");
				const room = await chatApi.getChatRoom(roomFromUrl);
				if (room?.type === "LOAD" && room.isLoadArchived) {
					useChatStore.getState().addChatRoom(room);
				} else if (!chatRooms.some(r => r.id === roomFromUrl)) {
					useChatStore.getState().addChatRoom(room);
				}
				setSelectedChatRoomId(roomFromUrl);
				webSocketChatSync.setCurrentChatRoom(room);
			} catch {
				// ignore — room inaccessible
			}
		};

		trySelect().catch(() => {});
	}, [roomFromUrl, chatRooms, webSocketChatSync]);
	const { isAddRoomModalOpen, closeAddRoomModal, isContactsModalOpen, closeContactsModal } =
		useChatModal();
	// Clear active chat when component unmounts (user leaves chat page)
	useEffect(() => {
		return () => {
			// Clear current chat room from store when leaving the chat page
			webSocketChatSync.setCurrentChatRoom(null);
		};
	}, []); // Empty dependency array to run only on unmount

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
				<div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-[28%]">
					<ChatList
						onChatSelect={handleChatSelect}
						selectedChatId={selectedChatRoomId || undefined}
						webSocketChatSync={webSocketChatSync}
					/>
				</div>

				{/* Right Side - Chat Box */}
				<ChatBox
					selectedChatRoomId={selectedChatRoomId || undefined}
					webSocketChatSync={webSocketChatSync}
				/>
			</div>

			{/* Modals */}
			<AddNewRoomModal isOpen={isAddRoomModalOpen} onClose={closeAddRoomModal} />
			<ContactsModal isOpen={isContactsModalOpen} onClose={closeContactsModal} />
		</>
	);
}
