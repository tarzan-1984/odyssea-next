"use client";
import React, { useState, useEffect } from "react";
import { Message, ChatRoom } from "@/app-api/chatApi";
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
	autoCloseDelay = 2000,
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const currentUser = useUserStore(state => state.currentUser);

	useEffect(() => {
		// Show notification with slight delay for smooth animation
		const showTimer = setTimeout(() => setIsVisible(true), 100);

		// Auto close after delay
		const closeTimer = setTimeout(() => {
			handleClose();
		}, autoCloseDelay);

		return () => {
			clearTimeout(showTimer);
			clearTimeout(closeTimer);
		};
	}, [autoCloseDelay]);

	const handleClose = () => {
		setIsClosing(true);
		setTimeout(() => {
			onClose();
		}, 300); // Match CSS transition duration
	};

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
		// Truncate message to fit in two lines
		if (content.length <= 60) return content;
		return content.substring(0, 57) + "...";
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
			className={`w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out ${
				isVisible && !isClosing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
			}`}
		>
			<div className="p-4">
				<div className="flex items-start space-x-3">
					{/* Chat Avatar */}
					<div className="flex-shrink-0">
						{chatAvatar ? (
							<img
								src={chatAvatar}
								alt={chatTitle}
								className="w-10 h-10 rounded-full object-cover"
								onError={e => {
									const target = e.target as HTMLImageElement;
									target.style.display = "none";
									const parent = target.parentElement;
									if (parent) {
										parent.innerHTML = `<div class="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-full">${generateInitials(chatTitle)}</div>`;
									}
								}}
							/>
						) : (
							<div className="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-full">
								{generateInitials(chatTitle)}
							</div>
						)}
					</div>

					{/* Content */}
					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
								{chatTitle}
							</h4>
							<button
								onClick={handleClose}
								className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
							>
								<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>

						<p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
							{messageContent}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
