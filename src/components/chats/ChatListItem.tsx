"use client";

import React, { useState, useEffect } from "react";
import { renderAvatar } from "@/helpers";
import { ChatRoom } from "@/app-api/chatApi";
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { MoreDotIcon, SoundOnIcon, SoundOffIcon, PinIcon, PushPinIcon } from "@/icons";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { chatApi } from "@/app-api/chatApi";

interface ChatListItemProps {
	chatRoom: ChatRoom;
	isSelected: boolean;
	status: "online" | "offline";
	onChatSelect: (chatRoom: ChatRoom) => void;
	isUserOnline?: (userId: string) => boolean;
	onChatRoomUpdate?: () => void; // Callback to refresh chat list
	isMenuOpen?: boolean; // Whether this menu is open (controlled by parent)
	onMenuToggle?: (isOpen: boolean) => void; // Callback to notify parent about menu state
}

export default function ChatListItem({
	chatRoom,
	isSelected,
	status,
	onChatSelect,
	isUserOnline,
	onChatRoomUpdate,
	isMenuOpen = false,
	onMenuToggle,
}: ChatListItemProps) {
	const currentUser = useCurrentUser();
	const { updateChatRoom } = useChatStore();
	const [isMuted, setIsMuted] = useState(chatRoom.isMuted || false);
	const [isPinned, setIsPinned] = useState(chatRoom.isPinned || false);

	const getChatDisplayName = (chatRoom: ChatRoom): string => {
		// For DIRECT chats, always show the other participant's name
		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(p => p.user.id !== currentUser?.id);
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

	const getChatLastMessage = (chatRoom: ChatRoom): string => {
		if (chatRoom.lastMessage) {
			if (chatRoom.lastMessage.fileUrl) {
				return `📎 ${chatRoom.lastMessage.fileName || "File"}`;
			}
			return chatRoom.lastMessage.content;
		}
		return "No messages yet";
	};

	const getChatLastMessageTime = (chatRoom: ChatRoom): string => {
		if (chatRoom.lastMessage) {
			const messageTime = new Date(chatRoom.lastMessage.createdAt);
			const now = new Date();
			const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));

			if (diffInMinutes < 1) return "Just now";
			if (diffInMinutes < 60) return `${diffInMinutes}m`;
			if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
			return `${Math.floor(diffInMinutes / 1440)}d`;
		}
		return "";
	};

	const toggleDropdown = () => {
		if (onMenuToggle) {
			onMenuToggle(!isMenuOpen);
		}
	};

	const closeDropdown = () => {
		if (onMenuToggle) {
			onMenuToggle(false);
		}
	};

	const handleToggleMute = async () => {
		try {
			const action = isMuted ? "unmute" : "mute";

			const result = await chatApi.muteChatRooms([chatRoom.id], action);

			// Determine the new mute state based on action
			const newMuteState = action === "mute";

			// Update local state immediately for better UX
			setIsMuted(newMuteState);
			// Update store to trigger re-sorting
			updateChatRoom(chatRoom.id, { isMuted: newMuteState });
			closeDropdown();
			// Refresh chat list to ensure proper sorting
			if (onChatRoomUpdate) {
				onChatRoomUpdate();
			}
		} catch (error) {
			console.error("Failed to toggle mute:", error);
		}
	};

	const handleTogglePin = async () => {
		try {
			const result = await chatApi.togglePinChatRoom(chatRoom.id);
			// Update local state immediately for better UX
			setIsPinned(result.pin);
			// Update store to trigger re-sorting
			updateChatRoom(chatRoom.id, { isPinned: result.pin });
			closeDropdown();
			// Refresh chat list to ensure proper sorting
			if (onChatRoomUpdate) {
				onChatRoomUpdate();
			}
		} catch (error) {
			console.error("Failed to toggle pin:", error);
		}
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			// Add small delay to prevent conflict with button click
			setTimeout(() => {
				const target = event.target as HTMLElement;
				if (!target.closest("[data-menu-trigger]") && !target.closest("[data-dropdown]")) {
					if (onMenuToggle && isMenuOpen) {
						onMenuToggle(false);
					}
				}
			}, 0);
		};

		if (isMenuOpen) {
			document.addEventListener("click", handleClickOutside);
		}

		return () => {
			document.removeEventListener("click", handleClickOutside);
		};
	}, [isMenuOpen, onMenuToggle]);

	return (
		<button
			key={chatRoom.id}
			onClick={e => {
				// Don't select chat if clicking on menu elements
				if ((e.target as HTMLElement).closest("[data-menu-trigger]")) {
					return;
				}
				onChatSelect(chatRoom);
			}}
			className={`w-full flex items-center py-3 pl-0 pr-3 rounded-lg transition-colors ${
				isSelected
					? "bg-blue-100 dark:bg-blue-900/30"
					: isMuted
						? "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50"
						: "hover:bg-gray-100 dark:hover:bg-gray-800"
			}`}
		>
			{/* Menu Icon - positioned before avatar */}
			<div className="relative flex-shrink-0 mr-2">
				<div
					onClick={e => {
						e.stopPropagation(); // Prevent chat selection when clicking menu
						e.preventDefault();
						toggleDropdown();
					}}
					className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer dropdown-toggle"
					data-menu-trigger
				>
					<MoreDotIcon className="w-4" />
				</div>

				<Dropdown
					isOpen={isMenuOpen}
					onClose={() => {
						closeDropdown();
					}}
					className="w-32 p-2 left-4 top-full mt-1"
					data-dropdown
				>
					<DropdownItem
						tag="div"
						onItemClick={e => {
							// Make TS happy if event can be undefined
							e?.stopPropagation(); // Prevent event bubbling to parent button
							handleToggleMute();
						}}
						className="flex items-center gap-2 w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 cursor-pointer"
					>
						{isMuted ? (
							<SoundOffIcon className="w-4 h-4 pointer-events-none" />
						) : (
							<SoundOnIcon className="w-4 h-4 pointer-events-none" />
						)}
						<span className="text-sm">{isMuted ? "Unmute" : "Mute"}</span>
					</DropdownItem>
					<DropdownItem
						tag="div"
						onItemClick={e => {
							// Make TS happy if event can be undefined
							e?.stopPropagation(); // Prevent event bubbling to parent button
							handleTogglePin();
						}}
						className="flex items-center gap-2 w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 cursor-pointer"
					>
						{isPinned ? (
							<PushPinIcon className="w-4 h-4 pointer-events-none" />
						) : (
							<PinIcon className="w-4 h-4 pointer-events-none" />
						)}
						<span className="text-sm">{isPinned ? "Unpin" : "Pin"}</span>
					</DropdownItem>
				</Dropdown>
			</div>

			<div className="relative flex-shrink-0">
				{(chatRoom.type === "GROUP" || chatRoom.type === "LOAD") &&
				(!chatRoom.avatar || chatRoom.avatar === "") ? (
					<div className="w-12 h-12 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center text-sm font-semibold text-gray-800 dark:text-gray-100">
						{(() => {
							const name = getChatDisplayName(chatRoom);
							const parts = name.trim().split(/\s+/).filter(Boolean);
							const initials =
								(parts[0]?.[0] || "").toUpperCase() +
								(parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
							return initials;
						})()}
					</div>
				) : (
					// Use renderAvatar for DIRECT chats
					(() => {
						if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
							const otherParticipant = chatRoom.participants.find(
								p => p.user.id !== currentUser?.id
							);
							if (otherParticipant) {
								const userData = {
									firstName: otherParticipant.user.firstName,
									lastName: otherParticipant.user.lastName,
									avatar:
										otherParticipant.user.avatar ||
										(otherParticipant.user as any).profilePhoto,
								};
								return renderAvatar(userData, "w-12 h-12");
							}
						}

						// Fallback for GROUP/LOAD chats with avatar
						if (chatRoom.avatar) {
							return (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={chatRoom.avatar}
									alt="avatar"
									className="w-12 h-12 rounded-full object-cover"
								/>
							);
						}

						// Final fallback - should not happen
						return renderAvatar(null, "w-12 h-12");
					})()
				)}
				{chatRoom.type === "DIRECT" && status === "online" && (
					<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
				)}
			</div>

			<div className="flex-1 ml-3 text-left min-w-0">
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-base font-medium text-gray-900 dark:text-white truncate flex-shrink min-w-0">
						{getChatDisplayName(chatRoom)}
					</h3>
					<span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
						{getChatLastMessageTime(chatRoom)}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
						{getChatLastMessage(chatRoom)}
					</p>
					{isPinned && (
						<PushPinIcon className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
					)}
					{isMuted && (
						<SoundOffIcon className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
					)}
				</div>
			</div>

			{typeof chatRoom.unreadCount === "number" && chatRoom.unreadCount > 0 && (
				<div className="ml-2 flex-shrink-0">
					<div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
						{chatRoom.unreadCount > 99 ? "99+" : chatRoom.unreadCount}
					</div>
				</div>
			)}
		</button>
	);
}
