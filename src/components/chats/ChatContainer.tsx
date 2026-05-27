"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ChatList from "./ChatList";
import ChatBox from "./ChatBox";
import AddNewRoomModal from "./AddNewRoomModal";
import ContactsModal from "./ContactsModal";
import { ChatRoom } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useChatModal } from "@/context/ChatModalContext";
import { useChatStore } from "@/stores/chatStore";
import { findActiveLoadChatInList, findArchivedLoadChat } from "@/utils/findLoadChatRoom";

export default function ChatContainer() {
	const searchParams = useSearchParams();
	const roomFromUrl = searchParams.get("room");
	const loadFromUrl = searchParams.get("load")?.trim() ?? null;
	const [selectedChatRoomId, setSelectedChatRoomId] = useState<string | null>(
		roomFromUrl || null
	);
	const [noAccessLoadId, setNoAccessLoadId] = useState<string | null>(null);
	const [expandArchiveSection, setExpandArchiveSection] = useState(false);
	const loadResolvedRef = useRef<string | null>(null);
	const roomResolvedRef = useRef<string | null>(null);
	// Initialize WebSocket chat sync at the container level
	const webSocketChatSync = useWebSocketChatSync();
	const chatRooms = useChatStore(s => s.chatRooms);
	const isLoadingChatRooms = useChatStore(s => s.isLoadingChatRooms);
	const setCurrentChatRoom = useChatStore(s => s.setCurrentChatRoom);

	const applySelectedRoom = useCallback(
		(room: ChatRoom) => {
			const { addChatRoom, chatRooms: rooms } = useChatStore.getState();
			if (!rooms.some(r => r.id === room.id)) {
				addChatRoom(room);
			}
			setSelectedChatRoomId(room.id);
			setCurrentChatRoom(room);
		},
		[setCurrentChatRoom]
	);

	useEffect(() => {
		if (!roomFromUrl) {
			roomResolvedRef.current = null;
			return;
		}
		if (isLoadingChatRooms) return;
		if (roomResolvedRef.current === roomFromUrl) return;

		const trySelect = async () => {
			const fromList = chatRooms.find(r => r.id === roomFromUrl);
			if (fromList) {
				roomResolvedRef.current = roomFromUrl;
				applySelectedRoom(fromList);
				return;
			}
			const curr = useChatStore.getState().currentChatRoom;
			if (curr?.id === roomFromUrl) {
				roomResolvedRef.current = roomFromUrl;
				setSelectedChatRoomId(roomFromUrl);
				return;
			}
			try {
				const { chatApi } = await import("@/app-api/chatApi");
				const room = await chatApi.getChatRoom(roomFromUrl);
				roomResolvedRef.current = roomFromUrl;
				applySelectedRoom(room);
			} catch {
				// ignore — room inaccessible
			}
		};

		trySelect().catch(() => {});
	}, [roomFromUrl, chatRooms, isLoadingChatRooms, applySelectedRoom]);

	useEffect(() => {
		if (!loadFromUrl) {
			loadResolvedRef.current = null;
			setExpandArchiveSection(false);
			setNoAccessLoadId(null);
			return;
		}
		if (isLoadingChatRooms) return;
		if (loadResolvedRef.current === loadFromUrl) return;

		let cancelled = false;

		const trySelectLoadChat = async () => {
			const active = findActiveLoadChatInList(chatRooms, loadFromUrl);
			if (active) {
				if (cancelled) return;
				loadResolvedRef.current = loadFromUrl;
				setExpandArchiveSection(false);
				setNoAccessLoadId(null);
				applySelectedRoom(active);
				return;
			}

			const archived = await findArchivedLoadChat(loadFromUrl);
			if (cancelled) return;
			if (!archived) {
				// User may not be a participant of this LOAD chat. Show a one-time info modal.
				loadResolvedRef.current = loadFromUrl;
				setExpandArchiveSection(false);
				setNoAccessLoadId(loadFromUrl);
				return;
			}

			loadResolvedRef.current = loadFromUrl;
			setExpandArchiveSection(true);
			setNoAccessLoadId(null);
			applySelectedRoom(archived);
		};

		trySelectLoadChat().catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [loadFromUrl, chatRooms, isLoadingChatRooms, applySelectedRoom]);

	const { isAddRoomModalOpen, closeAddRoomModal, isContactsModalOpen, closeContactsModal } =
		useChatModal();
	// Clear active chat when component unmounts (user leaves chat page)
	useEffect(() => {
		return () => {
			setCurrentChatRoom(null);
		};
	}, [setCurrentChatRoom]);

	const handleChatSelect = (chatRoom: ChatRoom) => {
		setSelectedChatRoomId(chatRoom.id);
		// Also set in the store for WebSocket functionality
		webSocketChatSync.setCurrentChatRoom(chatRoom);
		// Note: WebSocket room joining is handled automatically by useWebSocketMessages
	};

	return (
		<>
			{noAccessLoadId ? (
				<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 px-4">
					<div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
						<h4 className="text-base font-semibold text-gray-900 dark:text-white">
							No access
						</h4>
						<p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
							You are not a participant of this chat and don’t have access to it.
						</p>
						<div className="mt-4 flex justify-end">
							<button
								type="button"
								onClick={() => setNoAccessLoadId(null)}
								className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
							>
								OK
							</button>
						</div>
					</div>
				</div>
			) : null}
			<div className="flex flex-col h-full gap-6 xl:flex-row xl:gap-5">
				{/* Left Sidebar - Chat List */}
				<div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-[28%]">
					<ChatList
						onChatSelect={handleChatSelect}
						selectedChatId={selectedChatRoomId || undefined}
						webSocketChatSync={webSocketChatSync}
						expandArchiveSection={expandArchiveSection}
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
