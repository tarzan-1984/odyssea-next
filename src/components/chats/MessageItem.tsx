"use client";

import React from "react";
import { Message, ChatRoomParticipant, getMessageMultiAttachments } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";
import { renderAvatar, getRoleDisplayLabel, resolveAvatarBackground } from "@/helpers";
import { useOnlineStatus } from "@/context/OnlineStatusContext";
import MessageReadStatus from "./MessageReadStatus";
import MessageDropdown, { getMessageDropdownActionCount } from "./MessageDropdown";
import MessageReply from "./MessageReply";
import ChatMessageContent from "./ChatMessageContent";
import FilePreview from "./FilePreview";
import MessageAttachmentsGrid from "./MessageAttachmentsGrid";
import MessageReactions from "./MessageReactions";
import IncomingMessageBubble from "./IncomingMessageBubble";
import { formatNyWallClockDateTime } from "@/utils/nyWallClock";

interface MessageItemProps {
	message: Message;
	currentUser: UserData | null;
	/** When `"LOAD"`, driver role line shows `(externalId) Driver, time`. */
	chatRoomType?: string;
	/** Room participants for resolving read receipt names */
	chatParticipants?: ChatRoomParticipant[];
	/** Pre-built lookup from participants + loaded messages. */
	chatUserNameLookup?: Map<string, string>;
	onDelete: (messageId: string) => void;
	onEdit: (message: Message) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: () => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
	message,
	currentUser,
	chatRoomType,
	chatParticipants = [],
	chatUserNameLookup,
	onDelete,
	onEdit,
	onReply,
	onMarkUnread,
	onRetry,
}) => {
	const { isUserOnline } = useOnlineStatus();
	const isSender = message.senderId === currentUser?.id;
	const isOnline = isUserOnline(message.senderId);
	const isPending = Boolean(message.pendingOutgoing);
	const pendingStatus = message.pendingOutgoing?.status;
	const isPendingSending = pendingStatus === "sending" || pendingStatus === "uploading" || pendingStatus === "acknowledged";
	const isPendingFailed = pendingStatus === "failed";

	const isImageFile = (fileName?: string): boolean => {
		if (!fileName) return false;
		const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".heif", ".bmp", ".tiff", ".dng"];
		return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
	};

	const isPreviewableFile = (fileName?: string): boolean => {
		if (!fileName) return false;
		const previewableExtensions = [".pdf", ".docx", ".doc", ".txt"];
		return previewableExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
	};

	const isSystemMessage = Boolean(message.isSystemMessage);
	const senderFirstName = String(message.sender.firstName ?? "").trim();
	const senderExternalId = String(message.sender.externalId ?? "").trim();
	const isDriverSender = message.sender.role?.toUpperCase().trim() === "DRIVER";
	const isLoadTrackingRoleSender = ["TRACKING_TL", "TRACKING", "MORNING_TRACKING", "NIGHTSHIFT_TRACKING"].includes(
		message.sender.role?.toUpperCase().trim() ?? ""
	);
	const shouldShowPhoneUnderName =
		!isSender &&
		Boolean(String(message.sender.phone ?? "").trim()) &&
		(chatRoomType === "LOAD"
			? isDriverSender || isLoadTrackingRoleSender
			: isDriverSender);
	const shouldShowDriverExternalId = isDriverSender && Boolean(senderExternalId);
	const driverExternalIdPrefix = shouldShowDriverExternalId ? `(${senderExternalId}) ` : "";
	const senderNameLabel = `${driverExternalIdPrefix}${senderFirstName}`.trim();

	const incomingRoleLabel = (() => {
		const roleLabel = getRoleDisplayLabel(message.sender.role);
		return `${driverExternalIdPrefix}${roleLabel}`.trim();
	})();

	const incomingRoleAndTime = !isSender ? (
		<p className="chat-msg-meta text-gray-500 dark:text-gray-400">
			{`${isSystemMessage ? senderFirstName : incomingRoleLabel}, ${formatNyWallClockDateTime(message.createdAt)}`}
		</p>
	) : null;

	const driverPhoneDisplay = String(message.sender.phone ?? "").trim();

	const telHref = (displayPhone: string) => {
		const cleaned = displayPhone.replace(/[^\d+]/g, "");
		return cleaned ? `tel:${cleaned}` : `tel:${encodeURIComponent(displayPhone.trim())}`;
	};

	const incomingMessageFooter =
		!isSender && incomingRoleAndTime ? (
			<div className="mt-2 space-y-0.5">
				{incomingRoleAndTime}
				{shouldShowPhoneUnderName ? (
					<a
						href={telHref(driverPhoneDisplay)}
						className="chat-msg-meta inline-block font-medium text-brand-600 hover:underline dark:text-brand-400"
					>
						{driverPhoneDisplay}
					</a>
				) : null}
			</div>
		) : null;

	const multiAttachments = getMessageMultiAttachments(message);
	const legacyFileUrl = !multiAttachments ? message.fileUrl : undefined;
	const showLegacySingleFile = Boolean(legacyFileUrl);
	const showMessageMenu = !isPending && getMessageDropdownActionCount(message, currentUser) > 0;

	const renderMessageMenu = () =>
		showMessageMenu ? (
			<MessageDropdown
				message={message}
				currentUser={currentUser}
				onDelete={onDelete}
				onEdit={onEdit}
				onReply={onReply}
				onMarkUnread={onMarkUnread}
			/>
		) : null;

	return (
		<div className={`flex ${isSender ? "justify-end" : isSystemMessage ? "justify-start" : "items-start gap-4"}`}>
			{!isSender && !isSystemMessage && (
				<div className="relative h-10 w-10 shrink-0">
					<div
						className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
						style={{
							backgroundColor: resolveAvatarBackground(
								message.sender.role,
								message.sender.userColor ?? null,
							),
						}}
					>
						{renderAvatar(
							{
								avatar: message.sender.avatar,
								profilePhoto: message.sender.profilePhoto ?? undefined,
								firstName: message.sender.firstName,
								lastName: message.sender.lastName,
								role: message.sender.role,
								userColor: message.sender.userColor ?? null,
							},
							undefined,
							{ parentProvidesBackground: true },
						)}
					</div>
					{isOnline && (
						<span className="absolute bottom-0 right-0 z-10 block h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"></span>
					)}
				</div>
			)}

			<div
				className={
					isSender
						? "relative min-w-0 w-full max-w-[50%] shrink-0"
						: "relative min-w-0 w-full max-w-[50%] flex-1"
				}
			>
				{/* Incoming: first name above attachments and/or text bubble */}
				{!isSender &&
					senderNameLabel &&
					(showLegacySingleFile || message.content || multiAttachments) ? (
					<p className="chat-msg-name mb-1.5 font-medium text-gray-800 dark:text-white/90">
						{senderNameLabel}
					</p>
				) : null}

				{multiAttachments &&
					(isSender ? (
						<div className="mb-2 flex min-w-0 items-start justify-end gap-2">
							<div className="max-w-[32rem] min-w-0 space-y-2 rounded-lg rounded-tr-sm bg-brand-500 px-3 py-2 text-white dark:bg-brand-500">
								{message.replyData && <MessageReply replyData={message.replyData} />}
								<MessageAttachmentsGrid items={multiAttachments} isOutgoing />
								{message.content?.trim() ? (
									<ChatMessageContent content={message.content} isOutgoing />
								) : null}
							</div>
							{renderMessageMenu()}
						</div>
					) : (
						<>
							<div className="mb-2 flex min-w-0 items-start gap-2">
								<IncomingMessageBubble
									message={message}
									currentUserId={currentUser?.id}
									className="max-w-[32rem]"
								>
									<div className="space-y-2 rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 text-gray-800 dark:bg-white/5 dark:text-white/90">
										{message.replyData && <MessageReply replyData={message.replyData} />}
										<MessageAttachmentsGrid items={multiAttachments} />
										{message.content?.trim() ? (
											<ChatMessageContent content={message.content} />
										) : null}
									</div>
								</IncomingMessageBubble>
								<MessageDropdown
									message={message}
									currentUser={currentUser}
									onDelete={onDelete}
									onEdit={onEdit}
									onReply={onReply}
									onMarkUnread={onMarkUnread}
								/>
							</div>
							{incomingMessageFooter}
						</>
					))}

				{/* Image preview */}
				{showLegacySingleFile && legacyFileUrl && isImageFile(message.fileName) && (
					<div className={isSender ? "mb-2 ml-auto max-w-[400px]" : "mb-2"}>
						{!isSender ? (
							<IncomingMessageBubble message={message} currentUserId={currentUser?.id}>
								<FilePreview
									fileUrl={legacyFileUrl}
									fileName={message.fileName || "Unknown file"}
									fileSize={message.fileSize}
									messageId={message.id}
								/>
							</IncomingMessageBubble>
						) : (
							<div className="flex items-start justify-end gap-2">
								<FilePreview
									fileUrl={legacyFileUrl}
									fileName={message.fileName || "Unknown file"}
									fileSize={message.fileSize}
									messageId={message.id}
								/>
								<MessageDropdown
									message={message}
									currentUser={currentUser}
									onDelete={onDelete}
									onEdit={onEdit}
									onReply={onReply}
									onMarkUnread={onMarkUnread}
								/>
							</div>
						)}
					</div>
				)}

				{/* File preview for PDF, DOCX, TXT */}
				{showLegacySingleFile && legacyFileUrl && isPreviewableFile(message.fileName) && (
					<div className={isSender ? "mb-2 ml-auto max-w-[400px]" : "mb-2"}>
						{!isSender ? (
							<IncomingMessageBubble message={message} currentUserId={currentUser?.id}>
								<FilePreview
									fileUrl={legacyFileUrl}
									fileName={message.fileName || "Unknown file"}
									fileSize={message.fileSize}
									messageId={message.id}
								/>
							</IncomingMessageBubble>
						) : (
							<div className="flex items-start justify-end gap-2">
								<FilePreview
									fileUrl={legacyFileUrl}
									fileName={message.fileName || "Unknown file"}
									fileSize={message.fileSize}
									messageId={message.id}
								/>
								<MessageDropdown
									message={message}
									currentUser={currentUser}
									onDelete={onDelete}
									onEdit={onEdit}
									onReply={onReply}
									onMarkUnread={onMarkUnread}
								/>
							</div>
						)}
					</div>
				)}

				{/* File attachment for other files */}
				{showLegacySingleFile &&
					legacyFileUrl &&
					!isImageFile(message.fileName) &&
					!isPreviewableFile(message.fileName) && (
					<div
						className={
							isSender ? "mb-2 ml-auto w-full max-w-[270px]" : "mb-2 w-full max-w-[270px]"
						}
					>
						{!isSender ? (
							<IncomingMessageBubble message={message} currentUserId={currentUser?.id}>
								<a
									href={legacyFileUrl}
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
										<p className="chat-msg-body font-medium text-gray-900 dark:text-white truncate">
											{message.fileName || "Download file"}
										</p>
										{message.fileSize && (
											<p className="chat-msg-meta text-gray-500 dark:text-gray-400">
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
							</IncomingMessageBubble>
						) : (
							<div className="flex items-start justify-end gap-2">
							<a
								href={legacyFileUrl}
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
									<p className="chat-msg-body font-medium text-gray-900 dark:text-white truncate">
										{message.fileName || "Download file"}
									</p>
									{message.fileSize && (
										<p className="chat-msg-meta text-gray-500 dark:text-gray-400">
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
							{renderMessageMenu()}
							</div>
						)}
					</div>
				)}

				{/* Message content */}
				{message.content?.trim() && !multiAttachments &&
					(isSender ? (
						<div className="flex items-center justify-end gap-2">
							<div
								className={`px-3 py-2 rounded-lg bg-brand-500 text-white dark:bg-brand-500 rounded-tr-sm`}
							>
								{message.replyData && (
									<MessageReply replyData={message.replyData} />
								)}
								<ChatMessageContent content={message.content} isOutgoing />
							</div>
							{renderMessageMenu()}
						</div>
					) : (
						<>
							<div className="flex items-center gap-2">
								<IncomingMessageBubble message={message} currentUserId={currentUser?.id}>
									<div className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-white/90 rounded-tl-sm">
										{message.replyData && (
											<MessageReply replyData={message.replyData} />
										)}
										<ChatMessageContent content={message.content} />
									</div>
								</IncomingMessageBubble>
								<MessageDropdown
									message={message}
									currentUser={currentUser}
									onDelete={onDelete}
									onEdit={onEdit}
									onReply={onReply}
									onMarkUnread={onMarkUnread}
								/>
							</div>
							{incomingMessageFooter}
						</>
					))}

				{/* Incoming: role + time under legacy file-only messages (multi-attachment footer is inside block above) */}
				{!isSender && !message.content?.trim() && showLegacySingleFile ? incomingMessageFooter : null}

				<MessageReactions
					message={message}
					currentUserId={currentUser?.id}
					canReact={!isSender && !isPending}
					align={isSender ? "right" : "left"}
				/>

				{/* Timestamp and read status (outgoing only) */}
				{isSender && (
					<div className="mt-2 flex flex-col items-end gap-1">
						{isPending ? (
							<>
								{isPendingSending ? (
									<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
										<svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="4"
												fill="none"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
											/>
										</svg>
										<span className="chat-msg-meta">Sending...</span>
									</div>
								) : null}
								{isPendingFailed ? (
									<div className="flex items-center gap-2">
										<span className="chat-msg-meta text-error-500">Not sent</span>
										{onRetry ? (
											<button
												type="button"
												onClick={onRetry}
												className="chat-msg-meta rounded-md bg-brand-500 px-2 py-0.5 font-medium text-white hover:bg-brand-600"
											>
												Retry
											</button>
										) : null}
									</div>
								) : null}
							</>
						) : (
							<div className="flex items-center gap-1 justify-end">
								<MessageReadStatus
									isRead={message.isRead}
									readBy={message.readBy}
									participants={chatParticipants}
									userNameLookup={chatUserNameLookup}
									currentUserId={currentUser?.id ?? null}
									senderId={message.senderId}
									className="flex-shrink-0"
								/>
								<p className="chat-msg-meta text-gray-500 dark:text-gray-400">
									{formatNyWallClockDateTime(message.createdAt)}
								</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default MessageItem;
