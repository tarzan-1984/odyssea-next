"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import UserAvatar from "../common/UserAvatar";
import { ChatRoom, User } from "@/app-api/chatApi";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { MoreDotIcon } from "@/icons";
import { DropdownItem } from "@/components/ui/dropdown/DropdownItem";
import { useChatModal } from "@/context/ChatModalContext";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
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
	const { openAddRoomModal } = useChatModal();
	const { chatRooms, isLoadingChatRooms, loadChatRooms, isWebSocketConnected } =
		webSocketChatSync;

	const [isOpenTwo, setIsOpenTwo] = useState(false);

	function toggleDropdownTwo() {
		setIsOpenTwo(!isOpenTwo);
	}

	function closeDropdownTwo() {
		setIsOpenTwo(false);
	}

	useEffect(() => {
		loadChatRooms();
	}, [loadChatRooms]);

	const getChatDisplayName = (chatRoom: ChatRoom): string => {
		if (chatRoom.name) {
			return chatRoom.name;
		}

		// For direct chats, show the other participant's name
		if (chatRoom.type === "direct" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== "current-user-id"
			);
			if (otherParticipant) {
				return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
			}
		}

		// For group chats, show participant names
		if (chatRoom.type === "group") {
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

	const getChatAvatar = (chatRoom: ChatRoom): string => {
		if (chatRoom.type === "direct" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== "current-user-id"
			);
			if (otherParticipant?.user.avatar) {
				return otherParticipant.user.avatar;
			}
		}

		// Default avatar for group chats or when no profile photo
		return "/images/avatars/avatar-default.jpg";
	};

	const getChatUserData = (
		chatRoom: ChatRoom
	): { firstName: string; lastName: string; avatar?: string } => {
		if (chatRoom.type === "direct" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== "current-user-id"
			);
			if (otherParticipant) {
				return {
					firstName: otherParticipant.user.firstName,
					lastName: otherParticipant.user.lastName,
					avatar: otherParticipant.user.avatar,
				};
			}
		}

		// For group chats, use first participant or default
		if (chatRoom.participants.length > 0) {
			const firstParticipant = chatRoom.participants[0];
			return {
				firstName: firstParticipant.user.firstName,
				lastName: firstParticipant.user.lastName,
				avatar: firstParticipant.user.avatar,
			};
		}

		return { firstName: "Group", lastName: "Chat" };
	};

	const getChatStatus = (chatRoom: ChatRoom): "online" | "offline" => {
		// For direct chats, check if the other participant is online
		if (chatRoom.type === "direct" && chatRoom.participants.length === 2) {
			const otherParticipant = chatRoom.participants.find(
				p => p.user.id !== "current-user-id"
			);
			// In a real app, you'd check online status from API
			return Math.random() > 0.5 ? "online" : "offline";
		}

		return "offline";
	};

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
								onItemClick={closeDropdownTwo}
								className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
							>
								View More
							</DropdownItem>
							<DropdownItem
								onItemClick={closeDropdownTwo}
								className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
							>
								Delete
							</DropdownItem>
						</Dropdown>
					</div>
				</div>
			</div>

			{/* Search */}

			<div className="mt-4">
				<div className="relative my-2">
					<input
						type="text"
						placeholder="Search..."
						className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-[42px] pr-3.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
					/>
					<svg
						className="absolute -translate-y-1/2 left-4 top-1/2 text-gray-500"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M21 21L16.65 16.65M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</div>
			</div>

			{/* Chat List */}
			<div className="flex-1 overflow-y-auto">
				{!chatRooms || chatRooms.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-gray-500 text-center">
							<p>No chats yet</p>
							<p className="text-sm">Start a conversation!</p>
						</div>
					</div>
				) : (
					<div className="space-y-1 p-2">
						{chatRooms.map(chatRoom => {
							const isSelected = selectedChatId === chatRoom.id;
							const status = getChatStatus(chatRoom);

							return (
								<button
									key={chatRoom.id}
									onClick={() => onChatSelect(chatRoom)}
									className={`w-full flex items-center p-3 rounded-lg transition-colors ${
										isSelected
											? "bg-blue-100 dark:bg-blue-900/30"
											: "hover:bg-gray-100 dark:hover:bg-gray-800"
									}`}
								>
									<div className="relative flex-shrink-0">
										{(() => {
											const userData = getChatUserData(chatRoom);
											return (
												<UserAvatar
													src={userData.avatar}
													alt={getChatDisplayName(chatRoom)}
													firstName={userData.firstName}
													lastName={userData.lastName}
													width={48}
													height={48}
													className="w-12 h-12"
												/>
											);
										})()}
										{status === "online" && (
											<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
										)}
									</div>

									<div className="flex-1 ml-3 text-left min-w-0">
										<div className="flex items-center justify-between">
											<h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
												{getChatDisplayName(chatRoom)}
											</h3>
											<span className="text-xs text-gray-500 dark:text-gray-400">
												{getChatLastMessageTime(chatRoom)}
											</span>
										</div>
										<p className="text-sm text-gray-500 dark:text-gray-400 truncate">
											{getChatLastMessage(chatRoom)}
										</p>
									</div>

									{chatRoom.unreadCount !== 0 && (
										<div className="ml-2 flex-shrink-0">
											<div className="w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
												{chatRoom.unreadCount && chatRoom.unreadCount > 99
													? "99+"
													: chatRoom.unreadCount}
											</div>
										</div>
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
