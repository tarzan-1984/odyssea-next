"use client";

import { useChatModal } from "@/context/ChatModalContext";
import AddNewRoomModal from "@/components/chats/AddNewRoomModal";

export default function ChatPageClient() {
	const { isAddRoomModalOpen, closeAddRoomModal } = useChatModal();

	return <AddNewRoomModal isOpen={isAddRoomModalOpen} onClose={closeAddRoomModal} />;
}
