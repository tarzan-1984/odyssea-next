"use client";

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Message } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";

interface MessageDropdownProps {
	message: Message;
	currentUser?: UserData | null;
	onDelete?: (messageId: string) => void;
	onEdit?: (message: Message) => void;
	onReply?: (message: Message) => void;
	onMarkUnread?: (messageId: string) => void;
}

const MENU_WIDTH_PX = 176;
const MENU_GAP_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const MENU_ITEM_HEIGHT_PX = 32;
const MENU_VERTICAL_PADDING_PX = 8;

export function getMessageDropdownActionCount(
	message: Message,
	currentUser?: UserData | null
): number {
	const role = currentUser?.role?.trim().toUpperCase();
	const isAdmin = role === "ADMINISTRATOR";
	const isOwnMessage = message.senderId === currentUser?.id;
	const canEdit =
		(role === "ADMINISTRATOR" || role === "DRIVER_UPDATES") &&
		isOwnMessage &&
		Boolean(message.content?.trim());

	return (isOwnMessage ? 0 : 2) + (canEdit ? 1 : 0) + (isAdmin ? 1 : 0);
}

export default function MessageDropdown({
	message,
	currentUser,
	onDelete,
	onEdit,
	onReply,
	onMarkUnread,
}: MessageDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(
		null
	);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const role = currentUser?.role?.trim().toUpperCase();
	const isAdmin = role === "ADMINISTRATOR";

	// Check if message is from current user
	const isOwnMessage = message.senderId === currentUser?.id;
	const canEdit =
		(role === "ADMINISTRATOR" || role === "DRIVER_UPDATES") &&
		isOwnMessage &&
		Boolean(message.content?.trim());

	const visibleActionCount = getMessageDropdownActionCount(message, currentUser);

	if (visibleActionCount === 0) {
		return null;
	}

	const updateMenuPosition = useCallback(() => {
		const button = buttonRef.current;
		if (!button) return;

		const buttonRect = button.getBoundingClientRect();
		const menuHeight =
			menuRef.current?.getBoundingClientRect().height ||
			visibleActionCount * MENU_ITEM_HEIGHT_PX + MENU_VERTICAL_PADDING_PX;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const composerTop = document.querySelector("[data-chat-box] form")?.getBoundingClientRect()
			.top;
		const bottomBoundary =
			typeof composerTop === "number" ? Math.min(composerTop, viewportHeight) : viewportHeight;

		let left = buttonRect.right - MENU_WIDTH_PX;
		left = Math.min(left, viewportWidth - MENU_WIDTH_PX - VIEWPORT_PADDING_PX);
		left = Math.max(left, VIEWPORT_PADDING_PX);

		let top = buttonRect.bottom + MENU_GAP_PX;
		if (top + menuHeight > bottomBoundary - VIEWPORT_PADDING_PX) {
			top = buttonRect.top - menuHeight - MENU_GAP_PX;
		}
		top = Math.min(top, bottomBoundary - menuHeight - VIEWPORT_PADDING_PX);
		top = Math.max(top, VIEWPORT_PADDING_PX);

		setMenuPosition({ top, left });
	}, [visibleActionCount]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	useLayoutEffect(() => {
		if (!isOpen) {
			setMenuPosition(null);
			return;
		}

		updateMenuPosition();
		window.addEventListener("resize", updateMenuPosition);
		window.addEventListener("scroll", updateMenuPosition, true);

		return () => {
			window.removeEventListener("resize", updateMenuPosition);
			window.removeEventListener("scroll", updateMenuPosition, true);
		};
	}, [isOpen, updateMenuPosition]);

	const handleDelete = () => {
		if (onDelete) {
			onDelete(message.id);
		}
		setIsOpen(false);
	};

	const handleEdit = () => {
		if (onEdit) {
			onEdit(message);
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

	return (
		<div className="relative" ref={dropdownRef}>
			{/* Dropdown trigger button */}
			<button
				ref={buttonRef}
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
			{isOpen &&
				menuPosition &&
				typeof document !== "undefined" &&
				createPortal(
				<div
					ref={menuRef}
					data-message-dropdown-menu
					className="fixed z-[10050] w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
					style={{
						top: menuPosition.top,
						left: menuPosition.left,
					}}
				>
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

					{canEdit && (
						<button
							onClick={handleEdit}
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
									d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							Edit
						</button>
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
				</div>,
				document.body
			)}
		</div>
	);
}
