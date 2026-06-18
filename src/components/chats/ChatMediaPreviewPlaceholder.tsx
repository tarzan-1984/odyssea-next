"use client";

import React from "react";

type ChatMediaPreviewPlaceholderProps = {
	compact?: boolean;
	/** Used to reserve the same height as the eventual inline preview. */
	fileExtension?: string;
};

function placeholderHeightClass(compact: boolean, fileExtension?: string): string {
	if (compact) {
		return "h-24";
	}

	const ext = fileExtension?.toLowerCase();
	if (ext === "pdf" || ext === "doc" || ext === "docx") {
		return "h-64";
	}

	return "min-h-[180px]";
}

/** Skeleton shown until messages are loaded and preview enters the chat viewport. */
export function ChatMediaPreviewPlaceholder({
	compact = false,
	fileExtension,
}: ChatMediaPreviewPlaceholderProps) {
	const heightClass = placeholderHeightClass(compact, fileExtension);

	return (
		<div
			className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg w-full ${
				compact ? "max-w-none" : "max-w-[400px]"
			} ${heightClass}`}
			aria-hidden
		/>
	);
}
