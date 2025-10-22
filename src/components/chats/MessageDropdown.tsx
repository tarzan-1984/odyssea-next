"use client";

import React, { useState, useRef, useEffect } from "react";
import { Message } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";

interface MessageDropdownProps {
	message: Message;
	currentUser?: UserData | null;
	onDelete?: (messageId: string) => void;
	onReply?: (message: Message) => void;
	onMarkUnread?: (messageId: string) => void;
}

export default function MessageDropdown({
	message,
	currentUser,
	onDelete,
	onReply,
	onMarkUnread,
}: MessageDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	const handleDelete = () => {
		if (onDelete) {
			onDelete(message.id);
		}
		setIsOpen(false);
	};

	const handleReply = () => {
		if (onReply) {
			onReply(message);
		}
		setIsOpen(false);
	};

	const handleMarkUnread = () => {
		if (onMarkUnread) {
			onMarkUnread(message.id);
		}
		setIsOpen(false);
	};

	// Check if current user is admin
	const isAdmin = currentUser?.role === "ADMINISTRATOR";

	// Check if message is from current user
	const isOwnMessage = message.senderId === currentUser?.id;

	return (
		<div className="relative" ref={dropdownRef}>
			{/* Dropdown trigger button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				aria-label="Message options"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="text-gray-500 dark:text-gray-400"
				>
					<circle cx="12" cy="12" r="1" fill="currentColor" />
					<circle cx="12" cy="5" r="1" fill="currentColor" />
					<circle cx="12" cy="19" r="1" fill="currentColor" />
				</svg>
			</button>

			{/* Dropdown menu */}
			{isOpen && (
				<div className="absolute right-0 top-8 z-50 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
					{/* Show Reply and Mark as unread only for messages from other users */}
					{!isOwnMessage && (
						<>
							<button
								onClick={handleReply}
								className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									className="text-gray-500 dark:text-gray-400"
								>
									<path
										d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								Reply
							</button>

							<button
								onClick={handleMarkUnread}
								className="w-full px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
							>
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
									className="text-gray-500 dark:text-gray-400"
								>
									<path
										d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								Mark as unread
							</button>
						</>
					)}

					{/* Show delete button only for admin users */}
					{isAdmin && (
						<button
							onClick={handleDelete}
							className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
								className="text-red-500"
							>
								<path
									d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							Delete
						</button>
					)}
				</div>
			)}
		</div>
	);
}
