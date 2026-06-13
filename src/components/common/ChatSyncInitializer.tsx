"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useChatSync } from "@/hooks/useChatSync";
import { useCurrentUser, useUserStore } from "@/stores/userStore";
import { ODYSSEA_WS_RECONNECTED_EVENT } from "@/lib/websocketSyncEvents";
import { catchUpChatsOnReconnect } from "@/lib/chatReconnectSync";

/**
 * ChatSyncInitializer
 * - Globally loads chat rooms after user sign-in
 *   so the unread badge in the sidebar is correct right after app load.
 * - Skips loading on public pages like /tracking/[id]
 * - After WebSocket reconnects, diffs chat tails and batch-syncs only stale rooms.
 */
export default function ChatSyncInitializer() {
	const currentUser = useCurrentUser();
	const pathname = usePathname();
	const { loadChatRooms } = useChatSync();
	const hasLoadedRef = React.useRef(false);
	const lastPathnameRef = React.useRef<string | null>(null);
	const isCatchUpRunningRef = React.useRef(false);

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
			if (isCatchUpRunningRef.current) return;

			isCatchUpRunningRef.current = true;
			catchUpChatsOnReconnect()
				.catch((error: unknown) => {
					console.error("[ChatSync] Failed to catch up chats after WS reconnect:", error);
				})
				.finally(() => {
					isCatchUpRunningRef.current = false;
				});
		};

		window.addEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
		return () => window.removeEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
	}, []);

	// Render nothing
	return null;
}
