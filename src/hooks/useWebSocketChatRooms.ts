"use client";

import { useCallback } from "react";
import { useWebSocket } from "@/context/WebSocketContext";

export const useWebSocketChatRooms = () => {
	const { socket, isConnected } = useWebSocket();

	const createChatRoom = useCallback(
		(data: {
			name?: string;
			type: "DIRECT" | "GROUP" | "LOAD" | "BID";
			loadId?: string;
			participantIds: string[];
		}) => {
			if (socket && isConnected) {
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
		isLoading: false,
	};
};
