"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useChatStore } from "@/stores/chatStore";
import { ChatRoom, ChatRoomParticipant } from "@/app-api/chatApi";
import { useQueryClient } from "@tanstack/react-query";
import { ARCHIVED_LOAD_CHATS_QUERY_KEY } from "@/components/chats/loadArchivedChatsQueryKey";
import { removeArchivedLoadChatFromCache } from "@/utils/removeArchivedLoadChatFromCache";
import { stripPerUserChatRoomFields } from "@/utils/stripPerUserChatRoomFields";
import { isMeaningfulWebSocketError } from "@/utils/websocketError";

interface UseWebSocketChatRoomsProps {
	onChatRoomCreated?: (chatRoom: ChatRoom) => void;
	onChatRoomUpdated?: (data: {
		chatRoomId: string;
		updatedChatRoom: ChatRoom;
		updatedBy: string;
	}) => void;
	onParticipantsAdded?: (data: {
		chatRoomId: string;
		newParticipants: ChatRoomParticipant[];
		addedBy: string;
	}) => void;
	onParticipantRemoved?: (data: {
		chatRoomId: string;
		removedUserId: string;
		removedBy: string;
	}) => void;
	onAddedToChatRoom?: (data: {
		chatRoomId: string;
		addedBy: string;
	}) => void;
	onError?: (error: { message: string; details?: string }) => void;
}

function parseChatRoomCreatedPayload(
	data: { chatRoom: ChatRoom } | ChatRoom
): ChatRoom | undefined {
	if (data && typeof data === "object" && "chatRoom" in data) {
		const wrapped = (data as { chatRoom: ChatRoom }).chatRoom;
		return wrapped?.id ? wrapped : undefined;
	}
	if (data && typeof data === "object" && "id" in data) {
		const room = data as ChatRoom;
		return room.id ? room : undefined;
	}
	return undefined;
}

export const useWebSocketChatRooms = ({
	onChatRoomCreated,
	onChatRoomUpdated,
	onParticipantsAdded,
	onParticipantRemoved,
	onAddedToChatRoom,
	onError,
}: UseWebSocketChatRoomsProps) => {
	const { socket, isConnected } = useWebSocket();
	const { addChatRoom, updateChatRoom } = useChatStore();
	const queryClient = useQueryClient();
	const [isLoading, setIsLoading] = useState(false);
	const onChatRoomCreatedRef = useRef(onChatRoomCreated);
	const onChatRoomUpdatedRef = useRef(onChatRoomUpdated);
	const onParticipantsAddedRef = useRef(onParticipantsAdded);
	const onParticipantRemovedRef = useRef(onParticipantRemoved);
	const onAddedToChatRoomRef = useRef(onAddedToChatRoom);
	const onErrorRef = useRef(onError);

	onChatRoomCreatedRef.current = onChatRoomCreated;
	onChatRoomUpdatedRef.current = onChatRoomUpdated;
	onParticipantsAddedRef.current = onParticipantsAdded;
	onParticipantRemovedRef.current = onParticipantRemoved;
	onAddedToChatRoomRef.current = onAddedToChatRoom;
	onErrorRef.current = onError;

	useEffect(() => {
		if (!socket) return;

		const handleChatRoomCreated = (data: { chatRoom: ChatRoom } | ChatRoom) => {
			const room = parseChatRoomCreatedPayload(data);
			if (!room || !room.id) {
				console.warn("Invalid chatRoomCreated payload", data);
				return;
			}
			addChatRoom(room);
			onChatRoomCreatedRef.current?.(room);
		};

		const handleChatRoomUpdated = (data: {
			chatRoomId: string;
			updatedChatRoom: ChatRoom;
			updatedBy: string;
		}) => {
			updateChatRoom(
				data.chatRoomId,
				stripPerUserChatRoomFields(data.updatedChatRoom)
			);

			const patch = data.updatedChatRoom as Partial<ChatRoom> & { isLoadArchived?: boolean };
			if (patch.isLoadArchived === true) {
				queryClient
					.invalidateQueries({ queryKey: [...ARCHIVED_LOAD_CHATS_QUERY_KEY] })
					.catch(() => {});
			} else if (patch.isLoadArchived === false) {
				removeArchivedLoadChatFromCache(queryClient, data.chatRoomId);
			}

			onChatRoomUpdatedRef.current?.(data);
		};

		const handleParticipantsAdded = (data: {
			chatRoomId: string;
			newParticipants: ChatRoomParticipant[];
			addedBy: string;
		}) => {
			onParticipantsAddedRef.current?.(data);
		};

		const handleParticipantRemoved = (data: {
			chatRoomId: string;
			removedUserId: string;
			removedBy: string;
		}) => {
			onParticipantRemovedRef.current?.(data);
		};

		const handleAddedToChatRoom = (data: {
			chatRoomId: string;
			addedBy: string;
		}) => {
			onAddedToChatRoomRef.current?.(data);
		};

		const handleError = (error: { message: string; details?: string }) => {
			setIsLoading(false);
			if (!isMeaningfulWebSocketError(error)) return;
			onErrorRef.current?.(error);
		};

		socket.on("chatRoomCreated", handleChatRoomCreated);
		socket.on("chatRoomUpdated", handleChatRoomUpdated);
		socket.on("participantsAdded", handleParticipantsAdded);
		socket.on("participantRemoved", handleParticipantRemoved);
		socket.on("addedToChatRoom", handleAddedToChatRoom);
		socket.on("chatError", handleError);
		socket.on("error", handleError);

		return () => {
			socket.off("chatRoomCreated", handleChatRoomCreated);
			socket.off("chatRoomUpdated", handleChatRoomUpdated);
			socket.off("participantsAdded", handleParticipantsAdded);
			socket.off("participantRemoved", handleParticipantRemoved);
			socket.off("addedToChatRoom", handleAddedToChatRoom);
			socket.off("chatError", handleError);
			socket.off("error", handleError);
		};
	}, [socket, addChatRoom, updateChatRoom, queryClient]);

	const createChatRoom = useCallback(
		(data: {
			name?: string;
			type: "DIRECT" | "GROUP" | "LOAD" | "BID";
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

	const updateChatRoomHandler = useCallback(
		(data: {
			chatRoomId: string;
			updates: { name?: string; isArchived?: boolean; avatar?: string };
		}) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("updateChatRoom", data);
			}
		},
		[socket, isConnected]
	);

	const addParticipants = useCallback(
		(data: {
			chatRoomId: string;
			participantIds?: string[];
			participants?: Array<{ id: string; role: string }>;
		}) => {
			if (socket && isConnected) {
				setIsLoading(true);
				socket.emit("addParticipants", data);
			}
		},
		[socket, isConnected]
	);

	const removeParticipant = useCallback(
		(data: {
			chatRoomId: string;
			participantId: string;
			participantRole?: string;
		}) => {
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
