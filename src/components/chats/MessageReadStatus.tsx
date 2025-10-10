"use client";
import React from "react";

interface MessageReadStatusProps {
	isRead: boolean;
	className?: string;
}

export default function MessageReadStatus({ isRead, className = "" }: MessageReadStatusProps) {
	return (
		<div className={`${className}`} style={{ display: 'flex', alignItems: 'center' }}>
		{isRead ? (
			// Double checkmark (read) - blue color
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="text-blue-500"
			>
				<path d="M1.5 12.5L5.57574 16.5757C5.81005 16.8101 6.18995 16.8101 6.42426 16.5757L9 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
				<path d="M16 7L12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
				<path d="M7 12L11.5757 16.5757C11.8101 16.8101 12.1899 16.8101 12.4243 16.5757L22 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
			</svg>
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
