"use client";

import React from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { useCurrentUser } from "@/stores/userStore";

/**
 * Global WebSocket connection status indicator.
 * Shows online/offline state and provides a Reconnect button when disconnected.
 */
export default function WebSocketStatusIndicator() {
	const { isConnected, isDisplayOffline, connect } = useWebSocket();
	const currentUser = useCurrentUser();

	// Don't show when user is not logged in
	if (!currentUser) {
		return null;
	}

	const showOffline = isDisplayOffline || !isConnected;

	return (
		<div className="flex items-center gap-2">
			<div
				className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${
					!showOffline
						? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
						: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
				}`}
				title={!showOffline ? "Real-time connection active" : "Connection lost - real-time updates disabled"}
			>
				<div
					className={`h-2 w-2 rounded-full ${
						!showOffline ? "bg-green-500 animate-pulse" : "bg-red-500"
					}`}
				/>
				<span>{!showOffline ? "Online" : "Offline"}</span>
			</div>
			{showOffline && (
				<button
					type="button"
					onClick={() => connect()}
					className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
				>
					Reconnect
				</button>
			)}
		</div>
	);
}
