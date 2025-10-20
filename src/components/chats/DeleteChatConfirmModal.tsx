"use client";
import React, { useState } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { ChatRoom } from "@/app-api/chatApi";
import { TrashDeleteIcon } from "@/icons";
import { useCurrentUser } from "@/stores/userStore";
import { useWebSocketChatRooms } from "@/hooks/useWebSocketChatRooms";

interface DeleteChatConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	chatRoom?: ChatRoom;
	onDeleteSuccess?: () => void;
}

export default function DeleteChatConfirmModal({
	isOpen,
	onClose,
	chatRoom,
	onDeleteSuccess
}: DeleteChatConfirmModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const currentUser = useCurrentUser();
	const { removeParticipant } = useWebSocketChatRooms({});

	const handleDelete = async () => {
		if (!chatRoom || isDeleting || !currentUser || !currentUser.id) return;

		setIsDeleting(true);

		try {
			// Check if user is admin of group chat
			const isCurrentUserAdmin = chatRoom.adminId === currentUser.id;

			if (chatRoom.type === "LOAD") {
				// For LOAD chats, only administrators can delete
				if (currentUser.role !== "ADMINISTRATOR") {
					console.error("Only administrators can delete LOAD chats");
					return;
				}
				
				// Call the LOAD chat deletion endpoint
				const { chatApi } = await import("@/app-api/chatApi");
				await chatApi.deleteLoadChat(chatRoom.loadId || "");
			} else if (chatRoom.type === "GROUP" && !isCurrentUserAdmin) {
				// For group chats, non-admin users should leave the chat (remove themselves)
				removeParticipant({
					chatRoomId: chatRoom.id,
					participantId: currentUser.id
				});
			} else {
				// For direct chats or admin deleting group chat, use the existing delete API
				const { chatApi } = await import("@/app-api/chatApi");
				await chatApi.deleteChatRoom(chatRoom.id);
			}

			// Clear current chat room if it was the deleted one
			const { useChatStore } = await import("@/stores/chatStore");
			const state = useChatStore.getState();
			if (state.currentChatRoom?.id === chatRoom.id) {
				state.setCurrentChatRoom(null);
			}
			
			onDeleteSuccess?.();
			onClose();
		} catch (error) {
			console.error("Failed to delete/leave chat:", error);
			// You could add a toast notification here
		} finally {
			setIsDeleting(false);
		}
	};

	const getChatTypeText = () => {
		if (!chatRoom) return "";

		if (chatRoom.type === "DIRECT") {
			return "private chat";
		} else if (chatRoom.type === "GROUP") {
			const isCurrentUserAdmin = chatRoom.adminId === currentUser?.id;
			return isCurrentUserAdmin ? "group chat" : "group chat";
		} else if (chatRoom.type === "LOAD") {
			return "load chat";
		}

		return "";
	};

	const getConfirmMessage = () => {
		if (!chatRoom) return "";

		if (chatRoom.type === "DIRECT") {
			return "Are you sure you want to delete this private chat? The conversation will be hidden for you. If the other person sends a message, the chat will reappear.";
		} else if (chatRoom.type === "GROUP") {
			// Check if current user is the admin
			const isCurrentUserAdmin = chatRoom.adminId === currentUser?.id;

			if (isCurrentUserAdmin) {
				return "Are you sure you want to delete this group chat? This will permanently delete the chat for all participants.";
			} else {
				return "Are you sure you want to leave this group chat? You will no longer receive messages from this group.";
			}
		} else if (chatRoom.type === "LOAD") {
			return "Are you sure you want to delete this load chat? This will permanently delete the chat and archive all messages for all participants.";
		}

		return "";
	};

	const getActionText = () => {
		if (!chatRoom) return "Delete";

		if (chatRoom.type === "GROUP") {
			// Check if current user is the admin
			const isCurrentUserAdmin = chatRoom.adminId === currentUser?.id;
			return isCurrentUserAdmin ? "Delete Chat" : "Leave Chat";
		} else if (chatRoom.type === "LOAD") {
			return "Delete Chat";
		} else {
			return "Delete Chat";
		}
	};

	const getChatDisplayName = () => {
		if (!chatRoom) return "Unknown Chat";

		if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
			// For direct chats, show the other participant's name
			const otherParticipant = chatRoom.participants.find(p => p.user.id !== currentUser?.id);
			return otherParticipant ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` : "Direct Chat";
		}

		return chatRoom.name || "Group Chat";
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative w-full max-w-md m-5 sm:m-0 rounded-3xl bg-white p-6 dark:bg-gray-900"
		>
			<div className="text-center">
				{/* Icon */}
				<div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
					<TrashDeleteIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
				</div>

				{/* Title */}
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
					{chatRoom?.type === "GROUP" && chatRoom?.adminId !== currentUser?.id
						? `Leave ${getChatTypeText()}`
						: `Delete ${getChatTypeText()}`
					}
				</h3>

				{/* Chat name */}
				<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
					&#34;{getChatDisplayName()}&#34;
				</p>

				{/* Description */}
				<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
					{getConfirmMessage()}
				</p>

				{/* Action buttons */}
				<div className="flex gap-3">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={isDeleting}
						className="flex-1"
					>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleDelete}
						disabled={isDeleting}
						className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300"
					>
						{isDeleting ? "Deleting..." : getActionText()}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
