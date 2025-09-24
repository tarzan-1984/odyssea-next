"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatStore } from "@/stores/chatStore";
import { ChatRoom } from "@/app-api/chatApi";

interface UseWebSocketChatRoomsProps {
	onChatRoomCreated?: (chatRoom: ChatRoom) => void;
	onChatRoomUpdated?: (data: {
		chatRoomId: string;
		updatedChatRoom: ChatRoom;
		updatedBy: string;
	}) => void;
	onParticipantsAdded?: (data: {
		chatRoomId: string;
		newParticipants: any[];
		addedBy: string;
	}) => void;
	onParticipantRemoved?: (data: {
		chatRoomId: string;
		removedUserId: string;
		removedBy: string;
	}) => void;
	onError?: (error: { message: string; details?: string }) => void;
}

export const useWebSocketChatRooms = ({
	onChatRoomCreated,
	onChatRoomUpdated,
	onParticipantsAdded,
	onParticipantRemoved,
	onError,
}: UseWebSocketChatRoomsProps) => {
	const { socket, isConnected } = useWebSocket();
	const { addChatRoom, updateChatRoom } = useChatStore();
	const [isLoading, setIsLoading] = useState(false);

	// Set up event listeners
	useEffect(() => {
		if (!socket) return;

		const handleChatRoomCreated = (data: { chatRoom: ChatRoom }) => {
			// Add chat room to store
			addChatRoom(data.chatRoom);
			onChatRoomCreated?.(data.chatRoom);
		};

		const handleChatRoomUpdated = (data: {
			chatRoomId: string;
			updatedChatRoom: ChatRoom;
			updatedBy: string;
		}) => {
			// Update chat room in store
			updateChatRoom(data.chatRoomId, data.updatedChatRoom);
			onChatRoomUpdated?.(data);
		};

		const handleParticipantsAdded = (data: {
			chatRoomId: string;
			newParticipants: any[];
			addedBy: string;
		}) => {
			onParticipantsAdded?.(data);
		};

		const handleParticipantRemoved = (data: {
			chatRoomId: string;
			removedUserId: string;
			removedBy: string;
		}) => {
			onParticipantRemoved?.(data);
		};

		const handleError = (error: { message: string; details?: string }) => {
			setIsLoading(false);
			onError?.(error);
		};

		// Register event listeners
		socket.on("chatRoomCreated", handleChatRoomCreated);
		socket.on("chatRoomUpdated", handleChatRoomUpdated);
		socket.on("participantsAdded", handleParticipantsAdded);
		socket.on("participantRemoved", handleParticipantRemoved);
		socket.on("error", handleError);

		// Cleanup listeners
		return () => {
			socket.off("chatRoomCreated", handleChatRoomCreated);
			socket.off("chatRoomUpdated", handleChatRoomUpdated);
			socket.off("participantsAdded", handleParticipantsAdded);
			socket.off("participantRemoved", handleParticipantRemoved);
			socket.off("error", handleError);
		};
	}, [
		socket,
		addChatRoom,
		updateChatRoom,
		onChatRoomCreated,
		onChatRoomUpdated,
		onParticipantsAdded,
		onParticipantRemoved,
		onError,
	]);

	// Create chat room
	const createChatRoom = useCallback(
		(data: {
			name?: string;
			type: "DIRECT" | "GROUP" | "LOAD";
			loadId?: string;
			participantIds: string[];
		}) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("createChatRoom", data);
			}
		},
		[socket, isConnected]
	);

	// Update chat room
	const updateChatRoomHandler = useCallback(
		(data: { chatRoomId: string; updates: { name?: string; isArchived?: boolean } }) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("updateChatRoom", data);
			}
		},
		[socket, isConnected]
	);

	// Add participants
	const addParticipants = useCallback(
		(data: { chatRoomId: string; participantIds: string[] }) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("addParticipants", data);
			}
		},
		[socket, isConnected]
	);

	// Remove participant
	const removeParticipant = useCallback(
		(data: { chatRoomId: string; participantId: string }) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("removeParticipant", data);
			}
		},
		[socket, isConnected]
	);

	return {
		createChatRoom,
		updateChatRoom: updateChatRoomHandler,
		addParticipants,
		removeParticipant,
		isLoading,
	};
};
