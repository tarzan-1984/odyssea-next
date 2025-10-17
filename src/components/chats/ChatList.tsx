"use client";

import React, { useState, useEffect } from "react";
import { ChatRoom } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import ChatListItem from "./ChatListItem";
import { useChatModal } from "@/context/ChatModalContext";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { chatApi } from "@/app-api/chatApi";
import { useChatStore } from "@/stores/chatStore";
// WebSocket functionality is now passed via props

interface ChatListProps {
	onChatSelect: (chatRoom: ChatRoom) => void;
	selectedChatId?: string;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
}

export default function ChatList({
	onChatSelect,
	selectedChatId,
	webSocketChatSync,
}: ChatListProps) {
	const { openAddRoomModal, openContactsModal } = useChatModal();
	const { chatRooms, isLoadingChatRooms, loadChatRooms, isWebSocketConnected } =
		webSocketChatSync;

	const currentUser = useCurrentUser();
	const { updateChatRoom } = useChatStore();

	const [isOpenTwo, setIsOpenTwo] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

	const getChatDisplayName = (chatRoom: ChatRoom): string => {
		// For DIRECT chats, always show the other participant's name
		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== currentUser?.id
			);
			if (otherParticipant) {
				return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
			}
		}

		// For other chats, use the chat name if available
		if (chatRoom.name) {
			return chatRoom.name;
		}

		// For group chats, show participant names
		if (chatRoom.type === "GROUP") {
			const participantNames = chatRoom.participants
				.slice(0, 2)
				.map(p => p.user.firstName)
				.join(", ");
			return participantNames + (chatRoom.participants.length > 2 ? "..." : "");
		}

		return "Unknown Chat";
	};

	function toggleDropdownTwo() {
		setIsOpenTwo(!isOpenTwo);
	}

	function closeDropdownTwo() {
		setIsOpenTwo(false);
	}

	const clearSearch = () => {
		setSearchQuery("");
		setDebouncedSearchQuery("");
	};

	const handleMuteAll = async () => {
		try {
			console.log("Muting all chats...");
			console.log("All chat rooms:", chatRooms);
			console.log("Chat rooms length:", chatRooms.length);
			
			// Get all unmuted chat room IDs
			const unmutedChatRoomIds = chatRooms
				.filter(room => !room.isMuted)
				.map(room => room.id);
			
			console.log("Unmuted chat room IDs:", unmutedChatRoomIds);
			console.log("Unmuted chat room IDs length:", unmutedChatRoomIds.length);
			console.log("Chat rooms with isMuted status:", chatRooms.map(room => ({ id: room.id, name: room.name, isMuted: room.isMuted })));
			
			if (unmutedChatRoomIds.length === 0) {
				console.log("No unmuted chats to mute - exiting early");
				return;
			}
			
			console.log("Proceeding to mute", unmutedChatRoomIds.length, "chats");
			
			// Call the API with specific chat room IDs and mute action
			const result = await chatApi.muteChatRooms(unmutedChatRoomIds, 'mute');
			console.log("Mute all result:", result);
			
			// Update the store with the muted status for all affected chat rooms
			result.chatRoomIds.forEach(chatRoomId => {
				updateChatRoom(chatRoomId, { isMuted: true });
			});
			
			// Refresh chat list to update UI
			loadChatRooms();
		} catch (error) {
			console.error("Failed to mute all chats:", error);
		}
	};

	const handleUnmuteAll = async () => {
		try {
			console.log("Unmuting all chats...");
			console.log("All chat rooms:", chatRooms);
			console.log("Chat rooms length:", chatRooms.length);
			
			// Get all muted chat room IDs
			const mutedChatRoomIds = chatRooms
				.filter(room => room.isMuted)
				.map(room => room.id);
			
			console.log("Muted chat room IDs:", mutedChatRoomIds);
			console.log("Muted chat room IDs length:", mutedChatRoomIds.length);
			console.log("Chat rooms with isMuted status:", chatRooms.map(room => ({ id: room.id, name: room.name, isMuted: room.isMuted })));
			
			if (mutedChatRoomIds.length === 0) {
				console.log("No muted chats to unmute - exiting early");
				return;
			}
			
			console.log("Proceeding to unmute", mutedChatRoomIds.length, "chats");
			
			// Call the API with specific chat room IDs and unmute action
			const result = await chatApi.muteChatRooms(mutedChatRoomIds, 'unmute');
			console.log("Unmute all result:", result);
			
			// Update the store with the unmuted status for all affected chat rooms
			result.chatRoomIds.forEach(chatRoomId => {
				updateChatRoom(chatRoomId, { isMuted: false });
			});
			
			// Refresh chat list to update UI
			loadChatRooms();
		} catch (error) {
			console.error("Failed to unmute all chats:", error);
		}
	};

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, 300); // 300ms delay

		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Filter chat rooms based on search query
	const filteredChatRooms = chatRooms.filter(chatRoom => {
		if (!debouncedSearchQuery.trim()) return true;
		
		const chatName = getChatDisplayName(chatRoom).toLowerCase();
		const searchLower = debouncedSearchQuery.toLowerCase();
		
		return chatName.includes(searchLower);
	});

	useEffect(() => {
		loadChatRooms();
	}, [loadChatRooms]);

	if (isLoadingChatRooms) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-gray-500">Loading chats...</div>
			</div>
		);
	}

	return (
		<div className="sticky px-4 pt-4 pb-4 sm:px-5 sm:pt-5 xl:pb-0">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
						Chats
					</h3>
					{/* WebSocket connection status indicator */}
					<div className="flex items-center gap-1">
						<div
							className={`w-2 h-2 rounded-full ${isWebSocketConnected ? "bg-green-500" : "bg-red-500"}`}
						></div>
						<span className="text-xs text-gray-500 dark:text-gray-400">
							{isWebSocketConnected ? "Online" : "Offline"}
						</span>
					</div>
				</div>
				<div className="flex items-center gap-1">
					<div>
						<button className="dropdown-toggle d-block" onClick={toggleDropdownTwo}>
							<MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300" />
						</button>
						<Dropdown
							isOpen={isOpenTwo}
							onClose={closeDropdownTwo}
							className="w-40 p-2"
						>
							<DropdownItem
								onItemClick={() => {
									openAddRoomModal();
									setIsOpenTwo(false);
								}}
								className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
							>
								Add New Room
							</DropdownItem>
							<DropdownItem
								onItemClick={() => {
									openContactsModal();
									setIsOpenTwo(false);
								}}
								className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
							>
								Contacts
							</DropdownItem>
						</Dropdown>
					</div>
				</div>
			</div>

			{/* Mute All Buttons */}
			<div className="px-0 py-2 flex gap-2">
				<button
					onClick={handleMuteAll}
					className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
				>
					Mute all
				</button>
				<button
					onClick={handleUnmuteAll}
					className="flex-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors"
				>
					Unmute all
				</button>
			</div>

            {/* Search Bar */}
            <div className="px-0 py-1">
                <div className="relative">
                    <button className="absolute -translate-y-1/2 left-3 top-1/2">
                        <svg
                            className="fill-gray-500 dark:fill-gray-400"
                            width="16"
                            height="16"
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M3.04199 9.37381C3.04199 5.87712 5.87735 3.04218 9.37533 3.04218C12.8733 3.04218 15.7087 5.87712 15.7087 9.37381C15.7087 12.8705 12.8733 15.7055 9.37533 15.7055C5.87735 15.7055 3.04199 12.8705 3.04199 9.37381ZM9.37533 1.54218C5.04926 1.54218 1.54199 5.04835 1.54199 9.37381C1.54199 13.6993 5.04926 17.2055 9.37533 17.2055C11.2676 17.2055 13.0032 16.5346 14.3572 15.4178L17.1773 18.2381C17.4702 18.531 17.945 18.5311 18.2379 18.2382C18.5308 17.9453 18.5309 17.4704 18.238 17.1775L15.4182 14.3575C16.5367 13.0035 17.2087 11.2671 17.2087 9.37381C17.2087 5.04835 13.7014 1.54218 9.37533 1.54218Z"
                                fill=""
                            />
                        </svg>
                    </button>
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="dark:bg-dark-900 h-9 w-full rounded-lg border border-gray-300 bg-transparent pl-9 pr-9 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                    />
                    {searchQuery && (
                        <button 
                            onClick={clearSearch}
                            className="absolute -translate-y-1/2 right-3 top-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    fillRule="evenodd"
                                    clipRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    fill="currentColor"
                                />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Chat List */}
            <div className="overflow-y-auto h-[400px] max-h-[calc(100vh-220px)]">
				{!filteredChatRooms || filteredChatRooms.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-gray-500 text-center">
							{debouncedSearchQuery.trim() ? (
								<>
									<p>No chats found</p>
									<p className="text-sm">Try a different search term</p>
								</>
							) : (
								<>
									<p>No chats yet</p>
									<p className="text-sm">Start a conversation!</p>
								</>
							)}
						</div>
					</div>
				) : (
					<div className="space-y-1 py-2">
						{filteredChatRooms.map(chatRoom => {
							const isSelected = selectedChatId === chatRoom?.id;
							const status = chatRoom?.type === "DIRECT" && chatRoom.participants.length === 2
								? (() => {
									const otherParticipant = chatRoom.participants.find(
										p => p.user.id !== currentUser?.id
									);
									if (otherParticipant && webSocketChatSync.isUserOnline) {
										return webSocketChatSync.isUserOnline(otherParticipant.user.id) ? "online" : "offline";
									}
									return "offline";
								})()
								: "offline";

							return (
								<ChatListItem
									key={chatRoom.id}
									chatRoom={chatRoom}
									isSelected={isSelected}
									status={status}
									onChatSelect={onChatSelect}
									isUserOnline={webSocketChatSync.isUserOnline}
									onChatRoomUpdate={loadChatRooms}
								/>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
