"use client";

import React from "react";

type HeicConvertingOverlayProps = {
	className?: string;
	/** Card preview (chat attachment) vs fullscreen image modal */
	variant?: "preview" | "modal";
	message?: string;
};

export function HeicConvertingOverlay({
	className = "",
	variant = "preview",
	message = "Loading...",
}: HeicConvertingOverlayProps) {
	if (variant === "modal") {
		return (
			<div
				className={`absolute inset-4 flex items-center justify-center z-20 bg-black/50 rounded-lg sm:inset-8 ${className}`}
				role="status"
				aria-live="polite"
			>
				<div className="flex flex-col items-center gap-3">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
					<p className="text-sm text-white">{message}</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg z-10 ${className}`}
			role="status"
			aria-live="polite"
		>
			<div className="flex flex-col items-center gap-2">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
				<p className="text-xs text-gray-600 dark:text-gray-400">{message}</p>
			</div>
		</div>
	);
}
