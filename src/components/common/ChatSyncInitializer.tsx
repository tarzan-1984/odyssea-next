"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useChatSync } from "@/hooks/useChatSync";
import { useCurrentUser, useUserStore } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { ODYSSEA_WS_RECONNECTED_EVENT } from "@/lib/websocketSyncEvents";

/**
 * ChatSyncInitializer
 * - Globally loads chat rooms after user sign-in
 *   so the unread badge in the sidebar is correct right after app load.
 * - Skips loading on public pages like /tracking/[id]
 * - After WebSocket reconnects, forces API sync so messages/unread missed while offline appear.
 */
export default function ChatSyncInitializer() {
	const currentUser = useCurrentUser();
	const pathname = usePathname();
	const { loadChatRooms, loadMessages } = useChatSync();
	const hasLoadedRef = React.useRef(false);
	const lastPathnameRef = React.useRef<string | null>(null);

	React.useEffect(() => {
		// Check if we're on a tracking page
		const isTrackingPage = pathname?.startsWith("/tracking/") || 
			(typeof window !== "undefined" && window.location.pathname.startsWith("/tracking/"));

		// Reset hasLoadedRef if we moved from a non-tracking page to a tracking page
		if (isTrackingPage && lastPathnameRef.current && !lastPathnameRef.current.startsWith("/tracking/")) {
			hasLoadedRef.current = false;
		}

		// Update last pathname
		lastPathnameRef.current = pathname || (typeof window !== "undefined" ? window.location.pathname : null);

		// Skip loading chat rooms on public tracking page
		if (isTrackingPage) {
			return;
		}

		if (!currentUser) return;
		// Ensure a single initial load
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			loadChatRooms().catch((error: unknown) => {
				// Silent fail: initial load fallback will still work via UI flows
				console.error("Failed to load chat rooms:", error);
			});
		}
	}, [currentUser, loadChatRooms, pathname]);

	React.useEffect(() => {
		const onWsReconnected = () => {
			if (
				typeof window !== "undefined" &&
				window.location.pathname.startsWith("/tracking/")
			) {
				return;
			}
			if (!useUserStore.getState().currentUser) return;

			loadChatRooms({ force: true }).catch((error: unknown) => {
				console.error("[ChatSync] Failed to refresh chat rooms after WS reconnect:", error);
			});

			const openRoom = useChatStore.getState().currentChatRoom;
			if (openRoom?.id) {
				loadMessages(openRoom.id, 1, 50, { force: true }).catch((error: unknown) => {
					console.error("[ChatSync] Failed to refresh messages after WS reconnect:", error);
				});
			}
		};

		window.addEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
		return () => window.removeEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
	}, [loadChatRooms, loadMessages]);

	// Render nothing
	return null;
}
