"use client";

import { useEffect, useCallback } from "react";
import { useWebSocket } from "@/context/WebSocketContext";

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

	useEffect(() => {
		if (!socket) return;

		const handleNotification = (notification: Notification) => {
			onNotification?.(notification);
		};

		const handleRoleBroadcast = (broadcast: RoleBroadcast) => {
			onRoleBroadcast?.(broadcast);
		};

		const handleError = (error: { message: string; details?: string }) => {
			onError?.(error);
		};

		// Register event listeners
		socket.on("notification", handleNotification);
		socket.on("roleBroadcast", handleRoleBroadcast);
		socket.on("error", handleError);

		// Cleanup listeners
		return () => {
			socket.off("notification", handleNotification);
			socket.off("roleBroadcast", handleRoleBroadcast);
			socket.off("error", handleError);
		};
	}, [socket, onNotification, onRoleBroadcast, onError]);

	// Mark notification as read (if you have this functionality)
	const markNotificationAsRead = useCallback((notificationId: string) => {
		// Implement if your backend supports this
		console.log("Mark notification as read:", notificationId);
	}, []);

	return {
		markNotificationAsRead,
	};
};
