"use client";

import { useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { isMeaningfulWebSocketError } from "@/utils/websocketError";

interface Notification {
	id: string;
	title: string;
	message: string;
	type: string;
	isRead: boolean;
	createdAt: string;
	chatRoomId?: string;
}

interface RoleBroadcast {
	role: string;
	message: {
		title: string;
		content: string;
	};
}

interface UseWebSocketNotificationsProps {
	onNotification?: (notification: Notification) => void;
	onRoleBroadcast?: (broadcast: RoleBroadcast) => void;
	onError?: (error: { message: string; details?: string }) => void;
}

export const useWebSocketNotifications = ({
	onNotification,
	onRoleBroadcast,
	onError,
}: UseWebSocketNotificationsProps) => {
	const { socket } = useWebSocket();
	const onNotificationRef = useRef(onNotification);
	const onRoleBroadcastRef = useRef(onRoleBroadcast);
	const onErrorRef = useRef(onError);

	onNotificationRef.current = onNotification;
	onRoleBroadcastRef.current = onRoleBroadcast;
	onErrorRef.current = onError;

	useEffect(() => {
		if (!socket) return;

		const handleNotification = (notification: Notification) => {
			onNotificationRef.current?.(notification);
		};

		const handleRoleBroadcast = (broadcast: RoleBroadcast) => {
			onRoleBroadcastRef.current?.(broadcast);
		};

		const handleError = (error: { message: string; details?: string }) => {
			if (!isMeaningfulWebSocketError(error)) return;
			onErrorRef.current?.(error);
		};

		socket.on("notification", handleNotification);
		socket.on("roleBroadcast", handleRoleBroadcast);
		socket.on("chatError", handleError);
		socket.on("error", handleError);

		return () => {
			socket.off("notification", handleNotification);
			socket.off("roleBroadcast", handleRoleBroadcast);
			socket.off("chatError", handleError);
			socket.off("error", handleError);
		};
	}, [socket]);

	const markNotificationAsRead = useCallback((notificationId: string) => {
		console.log("Mark notification as read:", notificationId);
	}, []);

	return {
		markNotificationAsRead,
	};
};
