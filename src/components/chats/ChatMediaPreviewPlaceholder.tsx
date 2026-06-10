"use client";

import React from "react";

type ChatMediaPreviewPlaceholderProps = {
	compact?: boolean;
};

/** Skeleton shown until messages are loaded and preview enters the chat viewport. */
export function ChatMediaPreviewPlaceholder({
	compact = false,
}: ChatMediaPreviewPlaceholderProps) {
	return (
		<div
			className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg ${
				compact ? "h-24 w-full" : "h-32 w-full max-w-[400px]"
			}`}
			aria-hidden
		/>
	);
}
