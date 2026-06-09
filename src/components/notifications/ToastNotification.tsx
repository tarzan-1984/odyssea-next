"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Message, ChatRoom } from "@/app-api/chatApi";
import { CHAT_TOAST_AUTO_CLOSE_MS } from "@/constants/toastNotifications";
import { stripMarkdown } from "@/utils/chatMarkdown";
import { useUserStore } from "@/stores/userStore";

interface ToastNotificationProps {
	message: Message;
	chatRoom: ChatRoom;
	onClose: () => void;
	autoCloseDelay?: number;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
	message,
	chatRoom,
	onClose,
	autoCloseDelay = CHAT_TOAST_AUTO_CLOSE_MS,
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [avatarError, setAvatarError] = useState(false);
	const currentUser = useUserStore(state => state.currentUser);

	useEffect(() => {
		// Show notification with slight delay for smooth animation
		const showTimer = setTimeout(() => setIsVisible(true), 100);
		return () => clearTimeout(showTimer);
	}, []);

	const handleClose = useCallback(() => {
		setIsClosing(true);
		setTimeout(() => {
			onClose();
		}, 300); // Match CSS transition duration
	}, [onClose]);

	useEffect(() => {
		if (isHovered || isClosing) return;

		const closeTimer = setTimeout(() => {
			handleClose();
		}, autoCloseDelay);

		return () => clearTimeout(closeTimer);
	}, [autoCloseDelay, handleClose, isClosing, isHovered]);

	const getChatTitle = () => {
		if (chatRoom.type === "DIRECT") {
			// For DIRECT chats show the other participant's name
			const otherParticipant = chatRoom.participants.find(
				p => p.user?.id !== currentUser?.id
			);
			return otherParticipant?.user
				? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`
				: "Direct Chat";
		}
		// For group chats show the chat name
		return chatRoom.name || "Group Chat";
	};

	const getChatAvatar = () => {
		if (chatRoom.type === "DIRECT") {
			const otherParticipant = chatRoom.participants.find(
				p => p.user?.id !== currentUser?.id
			);
			// Support both avatar and legacy profilePhoto fields
			return (
				(otherParticipant?.user?.avatar as string) ||
				(otherParticipant?.user as any)?.profilePhoto ||
				undefined
			);
		}
		return chatRoom.avatar;
	};

	const formatMessageContent = (content: string) => {
		const plain = stripMarkdown(content);
		if (plain.length <= 60) return plain;
		return plain.substring(0, 57) + "...";
	};

	const generateInitials = (name: string) => {
		const words = name.trim().split(/\s+/);
		if (words.length === 1) {
			return words[0].substring(0, 2).toUpperCase();
		}
		return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
	};

	const chatTitle = getChatTitle();
	const chatAvatar = getChatAvatar();
	const messageContent = formatMessageContent(message.content || "");

	return (
		<div
			className={`w-[min(calc(100vw-2rem),17.5rem)] xl:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out ${
				isVisible && !isClosing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
			}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="p-3 xl:p-4">
				<div className="flex items-start gap-2 xl:gap-3">
					{/* Chat Avatar */}
					<div className="flex-shrink-0">
						{chatAvatar && !avatarError ? (
							<img
								src={chatAvatar}
								alt={chatTitle}
								className="w-8 h-8 rounded-full object-cover xl:w-10 xl:h-10"
								onError={() => setAvatarError(true)}
							/>
						) : (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300 xl:h-10 xl:w-10 xl:text-sm">
								{generateInitials(chatTitle)}
							</div>
						)}
					</div>

					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between">
							<h4 className="truncate text-xs font-medium text-gray-900 dark:text-white xl:text-sm">
								{chatTitle}
							</h4>
							<button
								onClick={handleClose}
								className="ml-1.5 flex-shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300 xl:ml-2"
							>
								<svg className="h-3.5 w-3.5 xl:h-4 xl:w-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>

						<p className="mt-0.5 text-xs leading-snug text-gray-600 dark:text-gray-300 xl:mt-1 xl:text-sm xl:leading-relaxed">
							{messageContent}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
