"use client";

import { useEffect } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useCurrentUser } from "@/stores/userStore";

/**
 * Hook to ensure WebSocket is connected when entering a page that needs real-time updates.
 * Call this on pages like Offers, Chat, etc. to trigger reconnect if connection was lost.
 */
export function useWebSocketConnectionCheck() {
	const { isConnected, connect } = useWebSocket();
	const currentUser = useCurrentUser();

	useEffect(() => {
		if (currentUser && !isConnected) {
			connect();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- connect identity changes every render, we only want to run on mount or when connection state changes
	}, [currentUser, isConnected]);
}
