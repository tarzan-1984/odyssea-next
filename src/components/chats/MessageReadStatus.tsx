"use client";
import React from "react";

interface MessageReadStatusProps {
	isRead: boolean;
	className?: string;
}

export default function MessageReadStatus({ isRead, className = "" }: MessageReadStatusProps) {
	return (
		<div className={`inline-flex items-center ${className}`}>
		{isRead ? (
			// Two checkmarks (read) - blue color
			<div className="relative">
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="text-blue-500"
				>
					<path
						d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
						fill="currentColor"
					/>
				</svg>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="text-blue-500 absolute -left-1 top-0"
				>
					<path
						d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
						fill="currentColor"
					/>
				</svg>
			</div>
		) : (
				// Single checkmark (sent) - gray color
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="text-gray-500"
				>
					<path
						d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
						fill="currentColor"
					/>
				</svg>
			)}
		</div>
	);
}
