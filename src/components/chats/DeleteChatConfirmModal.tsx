"use client";
import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { ChatRoom } from "@/app-api/chatApi";
import { LogOut } from "lucide-react";
import { TrashDeleteIcon } from "@/icons";
import { useCurrentUser } from "@/stores/userStore";
import { useWebSocket } from "@/context/WebSocketContext";
import { useWebSocketChatRooms } from "@/hooks/useWebSocketChatRooms";
import { ARCHIVED_LOAD_CHATS_QUERY_KEY } from "./loadArchivedChatsQueryKey";
import { isMultiUserChatType } from "@/utils/chatRoomTypes";

interface DeleteChatConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	chatRoom?: ChatRoom;
	mode?: "delete" | "leave";
	onDeleteSuccess?: () => void;
}

export default function DeleteChatConfirmModal({
	isOpen,
	onClose,
	chatRoom,
	mode = "delete",
	onDeleteSuccess,
}: DeleteChatConfirmModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const currentUser = useCurrentUser();
	const queryClient = useQueryClient();
	const { isConnected, leaveChatRoom } = useWebSocket();
	const { removeParticipant } = useWebSocketChatRooms();
	const isLeaveLoadChat = mode === "leave" && chatRoom?.type === "LOAD";

	const handleLeaveLoadChat = async () => {
		if (!chatRoom || isDeleting || !currentUser?.id) return;

		if (!isConnected) {
			setError("You are offline. Reconnect and try again.");
			return;
		}

		setIsDeleting(true);
		setError(null);

		try {
			removeParticipant({
				chatRoomId: chatRoom.id,
				participantId: currentUser.id,
				participantRole: currentUser.role,
			});
			leaveChatRoom(chatRoom.id);

			const { useChatStore } = await import("@/stores/chatStore");
			useChatStore.getState().removeChatRoom(chatRoom.id);

			window.dispatchEvent(
				new CustomEvent("odyssea:clearSelectedChat", {
					detail: { chatRoomId: chatRoom.id },
				}),
			);

			onDeleteSuccess?.();
			onClose();
		} catch (leaveError) {
			console.error("Failed to leave chat:", leaveError);
			setError("Failed to leave chat. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const handleDelete = async () => {
		if (isLeaveLoadChat) {
			await handleLeaveLoadChat();
			return;
		}

		if (!chatRoom || isDeleting || !currentUser || !currentUser.id) return;

		setIsDeleting(true);
		setError(null);

		try {
			// Check if user is admin of group chat
			const isCurrentUserAdmin = chatRoom.adminId === currentUser.id;
			const { useChatStore } = await import("@/stores/chatStore");
			const state = useChatStore.getState();

			if (chatRoom.type === "LOAD") {
				// For LOAD chats, only administrators can delete
				if (currentUser.role !== "ADMINISTRATOR") {
					console.error("Only administrators can delete LOAD chats");
					return;
				}

				// Call the LOAD chat deletion endpoint for this specific room
				const { chatApi } = await import("@/app-api/chatApi");
				await chatApi.deleteLoadChat(chatRoom.loadId || "", chatRoom.id);
				state.removeChatRoom(chatRoom.id);
			} else if (isMultiUserChatType(chatRoom.type) && !isCurrentUserAdmin) {
				// For group/bid chats, non-admin users should leave the chat (remove themselves)
				removeParticipant({
					chatRoomId: chatRoom.id,
					participantId: currentUser.id,
					participantRole: currentUser.role,
				});
				state.removeChatRoom(chatRoom.id);
			} else {
				// For direct chats or admin deleting group/bid chat, use the existing delete API
				const { chatApi } = await import("@/app-api/chatApi");
				await chatApi.deleteChatRoom(chatRoom.id);
				state.removeChatRoom(chatRoom.id);
			}

			if (chatRoom.type === "LOAD") {
				queryClient
					.invalidateQueries({ queryKey: [...ARCHIVED_LOAD_CHATS_QUERY_KEY] })
					.catch(() => {});
			}

			window.dispatchEvent(
				new CustomEvent("odyssea:clearSelectedChat", {
					detail: { chatRoomId: chatRoom.id },
				}),
			);

			onDeleteSuccess?.();
			onClose();
		} catch (deleteError) {
			console.error("Failed to delete/leave chat:", deleteError);
			setError("Failed to delete chat. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const getChatTypeText = () => {
		if (!chatRoom) return "";

		if (chatRoom.type === "DIRECT") {
			return "private chat";
		} else if (isMultiUserChatType(chatRoom.type)) {
			return chatRoom.type === "BID" ? "bid chat" : "group chat";
		} else if (chatRoom.type === "LOAD") {
			return "load chat";
		}

		return "";
	};

	const getConfirmMessage = () => {
		if (isLeaveLoadChat) {
			return "Are you sure you want to leave this load chat? You will be removed as a participant. Messages will stay in the chat.";
		}

		if (!chatRoom) return "";

		if (chatRoom.type === "DIRECT") {
			return "Are you sure you want to delete this private chat? The conversation will be hidden for you. If the other person sends a message, the chat will reappear.";
		} else if (isMultiUserChatType(chatRoom.type)) {
			// Check if current user is the admin
			const isCurrentUserAdmin = chatRoom.adminId === currentUser?.id;
			const label = chatRoom.type === "BID" ? "bid chat" : "group chat";

			if (isCurrentUserAdmin) {
				return `Are you sure you want to delete this ${label}? This will permanently delete the chat for all participants.`;
			} else {
				return `Are you sure you want to leave this ${label}? You will no longer receive messages from this group.`;
			}
		} else if (chatRoom.type === "LOAD") {
			return "Are you sure you want to delete this load chat? This will permanently delete the chat and archive all messages for all participants.";
		}

		return "";
	};

	const getActionText = () => {
		if (isLeaveLoadChat) return "Leave chat";
		if (!chatRoom) return "Delete";

		if (isMultiUserChatType(chatRoom.type)) {
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
			return otherParticipant
				? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`
				: "Direct Chat";
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
					{isLeaveLoadChat ? (
						<LogOut className="h-6 w-6 text-red-600 dark:text-red-400" />
					) : (
						<TrashDeleteIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
					)}
				</div>

				{/* Title */}
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
					{isLeaveLoadChat
						? "Leave load chat"
						: isMultiUserChatType(chatRoom?.type) && chatRoom?.adminId !== currentUser?.id
							? `Leave ${getChatTypeText()}`
							: `Delete ${getChatTypeText()}`}
				</h3>

				{/* Chat name */}
				<p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
					&#34;{getChatDisplayName()}&#34;
				</p>

				{/* Description */}
				<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
					{getConfirmMessage()}
				</p>
				{error ? (
					<p className="text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>
				) : null}

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
						{isDeleting
							? isLeaveLoadChat
								? "Leaving..."
								: "Deleting..."
							: getActionText()}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
