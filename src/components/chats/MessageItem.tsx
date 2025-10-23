"use client";

import React from "react";
import { Message } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";
import { renderAvatar } from "@/helpers";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import MessageReadStatus from "./MessageReadStatus";
import MessageDropdown from "./MessageDropdown";
import MessageReply from "./MessageReply";
import FilePreview from "./FilePreview";

interface MessageItemProps {
	message: Message;
	currentUser: UserData | null;
	onDelete: (messageId: string) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
	message,
	currentUser,
	onDelete,
	onReply,
	onMarkUnread,
}) => {
	const { isUserOnline } = useOnlineStatus();
	const isSender = message.senderId === currentUser?.id;
	const isOnline = isUserOnline(message.senderId);

	const formatTime = (timestamp: string) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: true,
		});
	};

	const isImageFile = (fileName?: string): boolean => {
		if (!fileName) return false;
		const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
		return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
	};

	const isPreviewableFile = (fileName?: string): boolean => {
		if (!fileName) return false;
		const previewableExtensions = [".pdf", ".docx", ".txt"];
		return previewableExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
	};

	return (
		<div
			className={`flex ${isSender ? "justify-end" : "items-start gap-4"} mb-4`}
		>
			{!isSender && (
				<div className="relative w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
					{renderAvatar({
						avatar: message.sender.avatar,
						firstName: message.sender.firstName,
						lastName: message.sender.lastName,
					}, "w-10 h-10")}
					{/* Online status indicator */}
					{isOnline && (
						<span className="absolute -bottom-0.5 -right-0.5 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
					)}
				</div>
			)}

			<div className={`${isSender ? "text-right" : ""}`}>
				{/* Image preview */}
				{message.fileUrl && isImageFile(message.fileName) && (
					<div className="mb-2">
						<FilePreview
							fileUrl={message.fileUrl}
							fileName={message.fileName || "Unknown file"}
							fileSize={message.fileSize}
							messageId={message.id}
						/>
					</div>
				)}

				{/* File preview for PDF, DOCX, TXT */}
				{message.fileUrl && isPreviewableFile(message.fileName) && (
					<div className="mb-2">
						<FilePreview
							fileUrl={message.fileUrl}
							fileName={message.fileName || "Unknown file"}
							fileSize={message.fileSize}
							messageId={message.id}
						/>
					</div>
				)}

				{/* File attachment for other files */}
				{message.fileUrl && !isImageFile(message.fileName) && !isPreviewableFile(message.fileName) && (
					<div className="mb-2 w-full max-w-[270px]">
						<a
							href={message.fileUrl}
							download={message.fileName}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
						>
							<svg
								width="20"
								height="20"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<polyline
									points="14,2 14,8 20,8"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-gray-900 dark:text-white truncate">
									{message.fileName || "Download file"}
								</p>
								{message.fileSize && (
									<p className="text-xs text-gray-500 dark:text-gray-400">
										{Math.round(message.fileSize / 1024)}KB
									</p>
								)}
							</div>
							<svg
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<polyline
									points="7,10 12,15 17,10"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
								<line
									x1="12"
									y1="15"
									x2="12"
									y2="3"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						</a>
					</div>
				)}

				{/* Message content */}
				{message.content && (
					<div className="flex items-center gap-2">
						<div
							className={`px-3 py-2 rounded-lg ${
								isSender
									? "bg-brand-500 text-white dark:bg-brand-500"
									: "bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white/90"
							} ${isSender ? "rounded-tr-sm" : "rounded-tl-sm"}`}
						>
							{/* Reply to message */}
							{message.replyData && (
								<MessageReply replyData={message.replyData} />
							)}
							<p className="text-sm">{message.content}</p>
						</div>
						{/* Message dropdown */}
						<MessageDropdown
							message={message}
							currentUser={currentUser}
							onDelete={onDelete}
							onReply={onReply}
							onMarkUnread={onMarkUnread}
						/>
					</div>
				)}

				{/* Timestamp and read status */}
				<div
					className={`mt-2 flex items-center gap-1 ${isSender ? "justify-end" : ""}`}
				>
					{isSender && (
						<MessageReadStatus
							isRead={message.isRead}
							className="flex-shrink-0"
						/>
					)}
					<p className="text-gray-500 text-theme-xs dark:text-gray-400">
						{isSender
							? formatTime(message.createdAt)
							: `${message.sender.role || "User"}, ${formatTime(message.createdAt)}`}
					</p>
				</div>
			</div>
		</div>
	);
};

export default MessageItem;