"use client";
import React from "react";
import { useChatSync } from "@/hooks/useChatSync";
import { useCurrentUser } from "@/stores/userStore";

/**
 * ChatSyncInitializer
 * - Globally loads chat rooms after user sign-in
 *   so the unread badge in the sidebar is correct right after app load.
 */
export default function ChatSyncInitializer() {
	const currentUser = useCurrentUser();
	const { loadChatRooms } = useChatSync();
	const hasLoadedRef = React.useRef(false);

	React.useEffect(() => {
		if (!currentUser) return;
		// Ensure a single initial load
		if (!hasLoadedRef.current) {
			hasLoadedRef.current = true;
			loadChatRooms().catch((error: unknown) => {
				// Silent fail: initial load fallback will still work via UI flows
				console.error("Failed to load chat rooms:", error);
			});
		}
	}, [currentUser, loadChatRooms]);

	// Render nothing
	return null;
}
