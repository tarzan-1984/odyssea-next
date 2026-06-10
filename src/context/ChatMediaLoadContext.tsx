"use client";

import React, { createContext, useContext } from "react";

type ChatMediaLoadContextValue = {
	/** True after initial messages for the room are loaded (API or cache). */
	mediaLoadEnabled: boolean;
	/** Scroll container for chat messages — IntersectionObserver root. */
	scrollRoot: Element | null;
};

const ChatMediaLoadContext = createContext<ChatMediaLoadContextValue>({
	mediaLoadEnabled: true,
	scrollRoot: null,
});

export function ChatMediaLoadProvider({
	mediaLoadEnabled,
	scrollRoot,
	children,
}: {
	mediaLoadEnabled: boolean;
	scrollRoot: Element | null;
	children: React.ReactNode;
}) {
	return (
		<ChatMediaLoadContext.Provider value={{ mediaLoadEnabled, scrollRoot }}>
			{children}
		</ChatMediaLoadContext.Provider>
	);
}

export function useChatMediaLoad() {
	return useContext(ChatMediaLoadContext);
}
