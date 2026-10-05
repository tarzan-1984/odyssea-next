"use client";

import React, { createContext, useContext } from "react";

const LoadChatDownloadContext = createContext<string | null>(null);

/** LOAD chats only: loads.reference_number used as the downloaded file name. */
export function LoadChatDownloadProvider({
	referenceNumber,
	children,
}: {
	referenceNumber?: string | null;
	children: React.ReactNode;
}) {
	const value = referenceNumber?.trim() || null;
	return (
		<LoadChatDownloadContext.Provider value={value}>{children}</LoadChatDownloadContext.Provider>
	);
}

export function useLoadChatReferenceNumber(): string | null {
	return useContext(LoadChatDownloadContext);
}
