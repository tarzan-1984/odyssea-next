"use client";

import React, { useState, useEffect } from "react";
import { ChatRoom } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { MoreDotIcon, SoundOffIcon, UnreadIcon, PushPinIcon } from "@/icons";
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

type FilterType = 'all' | 'muted' | 'unread' | 'favorite';

interface FilterOption {
	value: FilterType;
	label: string;
	icon: React.ReactNode;
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
	const { updateChatRoom, updateMessage } = useChatStore();

	const [isOpenTwo, setIsOpenTwo] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

	// Filter state
	const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
	const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

	// Filter options
	const filterOptions: FilterOption[] = [
		{ value: 'all', label: 'All', icon: null },
		{ value: 'muted', label: 'Muted', icon: <SoundOffIcon className="w-3 h-3" /> },
		{ value: 'unread', label: 'Unread', icon: <UnreadIcon className="w-3 h-3" /> },
		{ value: 'favorite', label: 'Favorite', icon: <PushPinIcon className="w-3 h-3" /> },
	];

	// Get current filter option
	const getCurrentFilterOption = () => {
		return filterOptions.find(option => option.value === selectedFilter) || filterOptions[0];
	};

	// Handle filter change
	const handleFilterChange = (filter: FilterType) => {
		setSelectedFilter(filter);
		setIsFilterDropdownOpen(false);
	};

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

	// Determine if all chats are muted
	const allChatsMuted = chatRooms.length > 0 && chatRooms.every(room => room.isMuted);
	const hasUnmutedChats = chatRooms.some(room => !room.isMuted);

	// Smart mute/unmute function
	const handleSmartMuteToggle = async () => {
		if (allChatsMuted) {
			// All chats are muted, so unmute all
			await handleUnmuteAll();
		} else {
			// Some or no chats are muted, so mute all
			await handleMuteAll();
		}
	};

	const handleMuteAll = async () => {
		try {
			// Get all unmuted chat room IDs
			const unmutedChatRoomIds = chatRooms
				.filter(room => !room.isMuted)
				.map(room => room.id);

			if (unmutedChatRoomIds.length === 0) {
				return;
			}

			// Call the API with specific chat room IDs and mute action
			const result = await chatApi.muteChatRooms(unmutedChatRoomIds, 'mute');

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
			// Get all muted chat room IDs
			const mutedChatRoomIds = chatRooms
				.filter(room => room.isMuted)
				.map(room => room.id);

			if (mutedChatRoomIds.length === 0) {
				return;
			}

			// Call the API with specific chat room IDs and unmute action
			const result = await chatApi.muteChatRooms(mutedChatRoomIds, 'unmute');

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

	const handleReadAll = async () => {
		try {
			// Get all chat room IDs with unread messages
			const unreadChatRoomIds = chatRooms
				.filter(room => (room.unreadCount || 0) > 0)
				.map(room => room.id);

			if (unreadChatRoomIds.length === 0) {
				return; // No unread messages
			}

			// Call the API to mark all messages as read
			const result = await chatApi.markAllMessagesAsReadByChatRooms(unreadChatRoomIds);

		} catch (error) {
			console.error("Failed to mark all messages as read:", error);
		}
	};

	// Debounce search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery);
		}, 300); // 300ms delay

		return () => clearTimeout(timer);
	}, [searchQuery]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (isFilterDropdownOpen) {
				const target = event.target as HTMLElement;
				if (!target.closest('.filter-dropdown')) {
					setIsFilterDropdownOpen(false);
				}
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [isFilterDropdownOpen]);

	// Filter chat rooms based on search query and selected filter
	const filteredChatRooms = chatRooms.filter(chatRoom => {
		// Apply search filter
		const matchesSearch = !debouncedSearchQuery.trim() ||
			getChatDisplayName(chatRoom).toLowerCase().includes(debouncedSearchQuery.toLowerCase());

		// Apply selected filter
		let matchesFilter = true;
		switch (selectedFilter) {
			case 'muted':
				matchesFilter = chatRoom.isMuted === true;
				break;
			case 'unread':
				matchesFilter = (chatRoom.unreadCount ?? 0) > 0;
				break;
			case 'favorite':
				matchesFilter = chatRoom.isPinned === true;
				break;
			case 'all':
			default:
				matchesFilter = true;
				break;
		}

		return matchesSearch && matchesFilter;
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

			{/* Filter Section */}
			<div className="border-t border-b border-gray-200 dark:border-gray-700 py-2 px-0">
				<div className="flex items-center gap-2">
					{/* Smart Mute/Unmute Button */}
					{chatRooms.length > 0 && (
						<button
							onClick={handleSmartMuteToggle}
							className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
						>
							{allChatsMuted ? "Unmute all" : "Mute all"}
						</button>
					)}

					{/* Read All Button */}
					{chatRooms.length > 0 && (
						<button
							onClick={handleReadAll}
							className="px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition-colors"
						>
							Read all
						</button>
					)}

					{/* Filter Dropdown */}
					<div className="flex-1 relative filter-dropdown">
						<button
							onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
							className="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
						>
							<div className="flex items-center gap-1">
								{getCurrentFilterOption().icon && (
									<div className="w-3 h-3">
										{getCurrentFilterOption().icon}
									</div>
								)}
								<span>{getCurrentFilterOption().label}</span>
							</div>
							<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
							</svg>
						</button>

						{/* Dropdown Menu */}
						{isFilterDropdownOpen && (
							<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-10">
								{filterOptions.map((option) => (
									<button
										key={option.value}
										onClick={() => handleFilterChange(option.value)}
										className={`w-full flex items-center gap-1 px-2 py-1 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t last:rounded-b ${
											selectedFilter === option.value
												? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
												: 'text-gray-700 dark:text-gray-300'
										}`}
									>
										{option.icon && (
											<div className="w-3 h-3">
												{option.icon}
											</div>
										)}
										<span>{option.label}</span>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
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
