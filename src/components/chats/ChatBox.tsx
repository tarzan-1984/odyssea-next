"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import ChatBoxHeader from "./ChatBoxHeader";
import ChatBoxSendForm, { type ChatBoxSendFormHandle } from "./ChatBoxSendForm";
import Image from "next/image";
import { Message, ChatRoom, isMessageReadByUser, chatApi } from "@/app-api/chatApi";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import { useChatRoomMessagesQuery } from "@/hooks/useChatRoomMessagesQuery";
import { useChatOutboxSend, type OutboundHttpSendFn } from "@/hooks/useChatOutboxSend";
import type { ChatOutboxItem } from "@/services/chatOutboxService";
import { useWebSocket } from "@/context/WebSocketContext";
import { messageReplacesOptimistic } from "@/utils/optimisticChatMessage";
// WebSocket functionality is now passed via props
import { useCurrentUser } from "@/stores/userStore";
import { useChatStore } from "@/stores/chatStore";
import { UserData } from "@/app-api/api-types";
import ChatBoxVirtualMessageList, {
	type ChatBoxVirtualMessageListHandle,
} from "./ChatBoxVirtualMessageList";
import { ChatImageGalleryProvider } from "./ChatImageGalleryContext";
import { ChatMediaLoadProvider } from "@/context/ChatMediaLoadContext";
import {
	removeChatMessageLocally,
	restoreChatMessageLocally,
} from "@/lib/chatMessageDelete";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

interface ChatBoxProps {
	selectedChatRoomId?: string;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
}

export default function ChatBox({ selectedChatRoomId, webSocketChatSync }: ChatBoxProps) {
	const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [replyingTo, setReplyingTo] = useState<Message["replyData"] | null>(null);
	const messagesContainerRef = useRef<HTMLDivElement | null>(null);
	const virtualListRef = useRef<ChatBoxVirtualMessageListHandle>(null);
	const [messagesScrollRoot, setMessagesScrollRoot] = useState<HTMLDivElement | null>(null);
	const attachMessagesContainer = useCallback((node: HTMLDivElement | null) => {
		messagesContainerRef.current = node;
		setMessagesScrollRoot(node);
	}, []);
	const sendFormRef = useRef<ChatBoxSendFormHandle>(null);
	const dragCounterRef = useRef(0);
	const isLoadingMoreRef = useRef(false);
	const hasUserScrolledRef = useRef(false);
	const isProgrammaticScrollRef = useRef(false);
	const isInitialScrollCompleteRef = useRef(false);
	const pendingInitialScrollRef = useRef(false);
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);

	// Get current user for message display
	const currentUser = useCurrentUser();

	const handleReplyToMessage = (message: Message) => {
		setReplyingTo({
			avatar: message.sender.avatar,
			time: message.createdAt,
			content: message.content,
			senderName: `${message.sender.firstName} ${message.sender.lastName}`,
		});
	};

	const handleCancelReply = () => {
		setReplyingTo(null);
	};

	// Use WebSocket chat sync for real-time functionality from props
	const {
		messages,
		isLoadingMessages: loading,
		webSocketMessages: { sendTyping, isTyping },
		isUserOnline,
	} = webSocketChatSync;

	const { sendMessage: wsSendMessage, socket } = useWebSocket();
	const addMessage = useChatStore(state => state.addMessage);
	const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

	const outgoingSender = useMemo(() => {
		if (!currentUser) return undefined;
		return {
			id: currentUser.id ?? "",
			firstName: currentUser.firstName ?? "",
			lastName: currentUser.lastName ?? "",
			avatar: currentUser.avatar,
			profilePhoto: currentUser.avatar,
			role: currentUser.role,
		};
	}, [currentUser]);

	const outboundSend = useCallback(
		async (
			content: string,
			fileData?: { fileUrl: string; fileName: string; fileSize: number },
			replyData?: Message["replyData"],
			attachments?: { fileUrl: string; fileName: string; fileSize?: number }[],
			clientMessageId?: string
		) => {
			if (!selectedChatRoomId) {
				throw new Error("No chat room selected");
			}

			const multi = attachments && attachments.length >= 2 ? attachments : null;
			const wsPayload = {
				chatRoomId: selectedChatRoomId,
				content,
				clientMessageId,
				fileUrl: multi ? multi[0].fileUrl : fileData?.fileUrl,
				fileName: multi ? multi[0].fileName : fileData?.fileName,
				fileSize: multi ? multi[0].fileSize : fileData?.fileSize,
				attachments: multi ?? undefined,
				replyData,
			};

			if (socket?.connected) {
				wsSendMessage(wsPayload);
				return;
			}

			const newMessage = await chatApi.sendMessage({
				chatRoomId: selectedChatRoomId,
				content,
				clientMessageId,
				replyData,
				...(multi
					? {
							attachments: multi,
							fileUrl: multi[0].fileUrl,
							fileName: multi[0].fileName,
							fileSize: multi[0].fileSize,
						}
					: {
							fileUrl: fileData?.fileUrl,
							fileName: fileData?.fileName,
							fileSize: fileData?.fileSize,
						}),
			});
			addMessage(newMessage);
			await indexedDBChatService.addMessage(newMessage);
		},
		[selectedChatRoomId, socket, wsSendMessage, addMessage]
	);

	const outboundSendHttp = useCallback<OutboundHttpSendFn>(
		async (item: ChatOutboxItem) => {
			if (!selectedChatRoomId) {
				throw new Error("No chat room selected");
			}

			const uploaded = item.uploadedAttachments;
			const multi = uploaded && uploaded.length >= 2 ? uploaded : null;
			const newMessage = await chatApi.sendMessage({
				chatRoomId: selectedChatRoomId,
				content: item.content,
				clientMessageId: item.clientMessageId,
				replyData: item.replyData,
				...(multi
					? {
							attachments: multi,
							fileUrl: multi[0].fileUrl,
							fileName: multi[0].fileName,
							fileSize: multi[0].fileSize,
						}
					: uploaded?.[0]
						? {
								fileUrl: uploaded[0].fileUrl,
								fileName: uploaded[0].fileName,
								fileSize: uploaded[0].fileSize,
							}
						: {}),
			});
			addMessage(newMessage);
			await indexedDBChatService.addMessage(newMessage);
			return newMessage;
		},
		[selectedChatRoomId, addMessage]
	);

	const { sendTextMessage, sendMediaMessage, retryOptimisticMessage } = useChatOutboxSend({
		chatRoomId: selectedChatRoomId,
		sender: outgoingSender,
		isConnected: Boolean(socket?.connected),
		socket,
		sendMessage: outboundSend,
		sendMessageHttp: outboundSendHttp,
		optimisticMessages,
		setOptimisticMessages,
		serverMessages: messages,
		currentUserId: currentUser?.id,
	});

	// Sync store before useChatRoomMessagesQuery hydrates (same tick as room switch).
	useLayoutEffect(() => {
		if (!selectedChatRoomId) return;
		const state = useChatStore.getState();
		if (state.currentChatRoom?.id !== selectedChatRoomId) {
			const room = state.chatRooms.find(r => r.id === selectedChatRoomId);
			if (room) {
				state.setCurrentChatRoom(room);
			}
		}
	}, [selectedChatRoomId]);

	const { isReady: messagesReady } = useChatRoomMessagesQuery(selectedChatRoomId);

	// Get error, chat room, and pagination state from store
	const error = useChatStore(state => state.error);
	const selectedChatRoom = useChatStore(state => {
		if (!selectedChatRoomId) return undefined;
		if (state.currentChatRoom?.id === selectedChatRoomId) {
			return state.currentChatRoom as ChatRoom;
		}
		return state.chatRooms.find(r => r.id === selectedChatRoomId);
	});

	const isLoadArchivedReadOnlyChat =
		selectedChatRoom?.type === "LOAD" && selectedChatRoom.isLoadArchived === true;
	const canAttachFiles = !isLoadArchivedReadOnlyChat;

	const hasFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

	const getClipboardFileName = (file: File, index: number) => {
		if (file.name) return file.name;

		const extensionByType: Record<string, string> = {
			"image/png": "png",
			"image/jpeg": "jpg",
			"image/gif": "gif",
			"image/webp": "webp",
			"application/pdf": "pdf",
			"text/plain": "txt",
		};
		const extension = extensionByType[file.type] || "bin";

		return `pasted-file-${index + 1}.${extension}`;
	};

	const getClipboardFiles = (clipboardData: DataTransfer): File[] => {
		const itemFiles = Array.from(clipboardData.items ?? [])
			.filter(item => item.kind === "file")
			.map(item => item.getAsFile())
			.filter((file): file is File => Boolean(file));

		const files = itemFiles.length > 0 ? itemFiles : Array.from(clipboardData.files ?? []);

		return files.map((file, index) => {
			const name = getClipboardFileName(file, index);
			if (file.name === name) return file;

			return new File([file], name, {
				type: file.type,
				lastModified: file.lastModified,
			});
		});
	};

	const handleChatDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!canAttachFiles || !hasFileDrag(e)) return;
		dragCounterRef.current += 1;
		setIsDragOver(true);
	};

	const handleChatDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!canAttachFiles) return;
		dragCounterRef.current -= 1;
		if (dragCounterRef.current <= 0) {
			dragCounterRef.current = 0;
			setIsDragOver(false);
		}
	};

	const handleChatDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!canAttachFiles || !hasFileDrag(e)) return;
		e.dataTransfer.dropEffect = "copy";
	};

	const handleChatDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		dragCounterRef.current = 0;
		setIsDragOver(false);
		if (!canAttachFiles) return;
		const files = Array.from(e.dataTransfer.files);
		if (files.length === 0) return;
		await sendFormRef.current?.addFiles(files);
	};

	const handleChatPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
		if (!canAttachFiles) return;

		const files = getClipboardFiles(e.clipboardData);
		if (files.length === 0) return;

		e.preventDefault();
		await sendFormRef.current?.addFiles(files);
	};

	useEffect(() => {
		dragCounterRef.current = 0;
		setIsDragOver(false);
	}, [selectedChatRoomId]);
	const hasMoreMessages = useChatStore(state => state.hasMoreMessages);
	const loadMoreMessages = useChatStore(state => state.loadMoreMessages);

	// Archive-related state and actions
	const isLoadingArchivedMessages = useChatStore(state => state.isLoadingArchivedMessages);
	const isLoadingAvailableArchives = useChatStore(state => state.isLoadingAvailableArchives);
	const tryLoadNextArchivePage = useChatStore(state => state.tryLoadNextArchivePage);
	const loadInitialArchiveIfPgEmpty = useChatStore(
		state => state.loadInitialArchiveIfPgEmpty
	);
	const setPendingArchiveLoad = useChatStore(state => state.setPendingArchiveLoad);

	// Merge server messages with in-flight optimistic outgoing messages.
	const uniqueMessages = React.useMemo(() => {
		if (!selectedChatRoomId) return [];
		const messageMap = new Map<string, Message>();
		for (const message of messages) {
			if (message.chatRoomId !== selectedChatRoomId) continue;
			messageMap.set(message.id, message);
		}
		const serverList = Array.from(messageMap.values());

		const activeOptimistic = optimisticMessages.filter(
			opt =>
				opt.chatRoomId === selectedChatRoomId &&
				!messageReplacesOptimistic(opt, serverList, currentUser?.id)
		);

		if (activeOptimistic.length === 0) {
			return serverList.sort(
				(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			);
		}

		return [...serverList, ...activeOptimistic].sort(
			(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		);
	}, [messages, selectedChatRoomId, optimisticMessages, currentUser?.id]);

	// WebSocket message handling is already provided by useWebSocketChatSync
	// No need to duplicate useWebSocketMessages here

	const scrollToBottom = useCallback(() => {
		isProgrammaticScrollRef.current = true;
		virtualListRef.current?.scrollToBottom();
		const container = messagesContainerRef.current;
		requestAnimationFrame(() => {
			if (container) {
				container.scrollTop = container.scrollHeight;
			}
			requestAnimationFrame(() => {
				if (container) {
					container.scrollTop = container.scrollHeight;
				}
				setTimeout(() => {
					isProgrammaticScrollRef.current = false;
				}, 50);
			});
		});
	}, []);

	const handleVirtualContentMeasured = useCallback(() => {
		if (pendingInitialScrollRef.current || !isInitialScrollCompleteRef.current) {
			scrollToBottom();
			return;
		}
		if (!isUserScrolledUp) {
			scrollToBottom();
		}
	}, [isUserScrolledUp, scrollToBottom]);

	const handleScroll = useCallback(() => {
		if (!messagesContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
		setIsUserScrolledUp(!isAtBottom);

		if (isProgrammaticScrollRef.current || !isInitialScrollCompleteRef.current) {
			return;
		}

		const hasScrollableContent = scrollHeight > clientHeight;

		if (
			hasScrollableContent &&
			scrollTop < 200 &&
			hasUserScrolledRef.current &&
			!loading &&
			!isLoadingMoreRef.current &&
			!isLoadingArchivedMessages &&
			uniqueMessages.length > 0
		) {
			isLoadingMoreRef.current = true;
			setIsLoadingOlder(true);

			const container = messagesContainerRef.current;
			const prevScrollHeight = container.scrollHeight;
			const prevScrollTop = container.scrollTop;

			const finalize = () => {
				const newScrollHeight = container.scrollHeight;
				const delta = newScrollHeight - prevScrollHeight;
				isProgrammaticScrollRef.current = true;
				container.scrollTop = prevScrollTop + delta;
				setTimeout(() => {
					isProgrammaticScrollRef.current = false;
					isLoadingMoreRef.current = false;
					setIsLoadingOlder(false);
				}, 50);
			};

			if (hasMoreMessages) {
				Promise.resolve(loadMoreMessages()).finally(finalize);
			} else if (isLoadingAvailableArchives) {
				setPendingArchiveLoad(true);
				isLoadingMoreRef.current = false;
				setIsLoadingOlder(false);
			} else {
				Promise.resolve(tryLoadNextArchivePage()).finally(finalize);
			}
		}
	}, [
		hasMoreMessages,
		loading,
		loadMoreMessages,
		isLoadingArchivedMessages,
		isLoadingAvailableArchives,
		tryLoadNextArchivePage,
		setPendingArchiveLoad,
		uniqueMessages.length,
	]);

	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		const markUserScroll = () => {
			if (!isProgrammaticScrollRef.current) {
				hasUserScrolledRef.current = true;
			}
		};

		container.addEventListener("wheel", markUserScroll, { passive: true });
		container.addEventListener("touchstart", markUserScroll, { passive: true });
		container.addEventListener("pointerdown", markUserScroll);

		return () => {
			container.removeEventListener("wheel", markUserScroll);
			container.removeEventListener("touchstart", markUserScroll);
			container.removeEventListener("pointerdown", markUserScroll);
		};
	}, [messagesScrollRoot]);

	useEffect(() => {
		if (selectedChatRoomId) {
			hasUserScrolledRef.current = false;
			isLoadingMoreRef.current = false;
			isProgrammaticScrollRef.current = false;
			isInitialScrollCompleteRef.current = false;
			pendingInitialScrollRef.current = true;
			setIsLoadingOlder(false);
			setIsUserScrolledUp(false);
		}
		setReplyingTo(null);
	}, [selectedChatRoomId]);

	useLayoutEffect(() => {
		if (!messagesReady || !selectedChatRoomId || uniqueMessages.length === 0) return;
		if (!pendingInitialScrollRef.current) return;

		scrollToBottom();

		const rafId = requestAnimationFrame(() => {
			scrollToBottom();
		});
		const timeoutId = window.setTimeout(() => {
			scrollToBottom();
			pendingInitialScrollRef.current = false;
			isInitialScrollCompleteRef.current = true;
		}, 200);

		return () => {
			cancelAnimationFrame(rafId);
			window.clearTimeout(timeoutId);
		};
	}, [messagesReady, selectedChatRoomId, uniqueMessages.length, scrollToBottom]);

	useEffect(() => {
		if (!messagesReady || !selectedChatRoomId) return;

		loadInitialArchiveIfPgEmpty().catch(error => {
			console.error("Failed to load initial archive:", error);
		});
	}, [messagesReady, selectedChatRoomId, loadInitialArchiveIfPgEmpty]);

	useEffect(() => {
		if (
			uniqueMessages.length > 0 &&
			!isUserScrolledUp &&
			isInitialScrollCompleteRef.current &&
			!pendingInitialScrollRef.current
		) {
			scrollToBottom();
		}
	}, [uniqueMessages.length, isUserScrolledUp, scrollToBottom]);

	const handleSendMessage = async (messageData: {
		content: string;
		fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number }[];
		replyData?: Message["replyData"];
	}) => {
		if (!selectedChatRoom) return;

		try {
			sendTyping(false);

			const files = messageData.fileData ?? [];
			if (files.length === 0) {
				await sendTextMessage(messageData.content, messageData.replyData);
			} else {
				await sendMediaMessage(
					messageData.content,
					files.map(f => ({
						fileUrl: f.fileUrl,
						fileName: f.fileName,
						fileSize: f.fileSize,
					})),
					messageData.replyData
				);
			}

			setTimeout(() => {
				scrollToBottom();
			}, 50);
		} catch (err) {
			console.error("Failed to send message:", err);
		}
	};

	// Handle message dropdown actions
	const handleDeleteMessage = async (messageId: string) => {
		const snapshot = removeChatMessageLocally(messageId);
		if (!snapshot) {
			return;
		}

		try {
			const response = await fetch(`/api/messages/${messageId}`, {
				method: "DELETE",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || errorData.message || "Failed to delete message");
			}
		} catch (error) {
			restoreChatMessageLocally(snapshot);
			console.error("Failed to delete message:", error);
		}
	};

	const handleMarkMessageUnread = async (messageId: string) => {
		try {
			const response = await fetch(`/api/messages/${messageId}/unread`, {
				method: "PUT",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || "Failed to mark message as unread");
			}

			const result = await response.json();

			// Get chat room type to determine logic
			const state = useChatStore.getState();
			const chatRoom = state.chatRooms.find(room => room.id === result.chatRoomId);
			const isDirectChat = chatRoom?.type === "DIRECT";

			// Optimistically update UI and cache
			const updatedMessages = state.messages.map(msg => {
				if (msg.id === messageId) {
					const currentReadBy = msg.readBy || [];
					const updatedReadBy = currentReadBy.filter(id => id !== currentUser?.id);

					if (isDirectChat) {
						// For DIRECT chats: set both isRead to false and remove user from readBy
						return {
							...msg,
							isRead: false, // Global read status becomes false
							readBy: updatedReadBy,
						};
					} else {
						// For GROUP and LOAD chats: only remove user from readBy, keep isRead as true
						return {
							...msg,
							readBy: updatedReadBy,
							// Keep isRead as true (global status doesn't change)
						};
					}
				}
				return msg;
			});
			state.setMessages(updatedMessages);

			// Update cache
			const { indexedDBChatService } = await import("@/services/IndexedDBChatService");
			const message = updatedMessages.find(m => m.id === messageId);
			if (message) {
				if (isDirectChat) {
					indexedDBChatService
						.updateMessage(messageId, {
							isRead: false,
							readBy: message.readBy,
						})
						.catch((error: Error) => {
							console.error("Failed to update message in IndexedDB:", error);
						});
				} else {
					indexedDBChatService
						.updateMessage(messageId, {
							readBy: message.readBy,
						})
						.catch((error: Error) => {
							console.error("Failed to update message in IndexedDB:", error);
						});
				}
			}
		} catch (error) {
			console.error("Failed to mark message as unread:", error);
		}
	};

	if (!selectedChatRoom) {
		return (
			<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4">
				<div className="flex items-center justify-center h-full">
					<div className="text-center text-gray-500 dark:text-gray-400">
						<svg
							width="64"
							height="64"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							className="mx-auto mb-4"
						>
							<path
								d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<p className="text-lg font-medium">Select a chat to start messaging</p>
						<p className="text-sm">Choose a conversation from the list to begin</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<ChatImageGalleryProvider messages={uniqueMessages}>
		<div
			data-chat-box
			className="@container/size relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] xl:w-3/4"
			onDragEnter={handleChatDragEnter}
			onDragLeave={handleChatDragLeave}
			onDragOver={handleChatDragOver}
			onDrop={handleChatDrop}
			onPaste={handleChatPaste}
		>
			{isDragOver && (
				<div
					className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-brand-500/10 backdrop-blur-[1px]"
					aria-hidden
				>
					<div className="rounded-xl border-2 border-dashed border-brand-500 bg-white/90 px-8 py-6 text-center shadow-lg dark:bg-gray-900/90">
						<p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
							Drop files to attach
						</p>
						<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
							Images, PDF, DOC, DOCX, TXT — up to 10MB each
						</p>
					</div>
				</div>
			)}
			{/* Header */}
			<ChatBoxHeader chatRoom={selectedChatRoom} isUserOnline={isUserOnline} />

			{/* Messages */}
			<div
				ref={attachMessagesContainer}
				onScroll={handleScroll}
				className="flex-1 max-h-full overflow-auto p-5 custom-scrollbar xl:p-6"
			>
				<ChatMediaLoadProvider
					mediaLoadEnabled={messagesReady}
					scrollRoot={messagesScrollRoot}
				>
				{/* Loading indicator for older messages */}
				{(isLoadingOlder || isLoadingArchivedMessages) && uniqueMessages.length > 0 && (
					<div className="flex items-center justify-center py-4">
						<div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
							<svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
							<span className="text-sm">
								{isLoadingOlder && "Loading older messages..."}
								{isLoadingArchivedMessages && "Loading archive..."}
							</span>
						</div>
					</div>
				)}

				{loading && uniqueMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-gray-500">Loading messages...</div>
					</div>
				) : error ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-red-500">{error}</div>
					</div>
				) : uniqueMessages.length === 0 ? (
					<div className="flex items-center justify-center h-full">
						<div className="text-center text-gray-500 dark:text-gray-400">
							<p>No messages yet</p>
							<p className="text-sm">Start the conversation!</p>
						</div>
					</div>
				) : (
					<ChatBoxVirtualMessageList
						ref={virtualListRef}
						messages={uniqueMessages}
						currentUser={currentUser}
						chatRoomType={selectedChatRoom?.type}
						chatParticipants={selectedChatRoom?.participants ?? []}
						scrollElement={messagesScrollRoot}
						onContentMeasured={handleVirtualContentMeasured}
						onDelete={handleDeleteMessage}
						onReply={handleReplyToMessage}
						onMarkUnread={handleMarkMessageUnread}
						onRetry={message => {
							retryOptimisticMessage(message).catch(error => {
								console.error("Failed to retry message:", error);
							});
						}}
					/>
				)}
				{/* Typing indicator */}
				{Object.entries(isTyping).some(([userId, data]) => data.isTyping) && (
					<div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
						<div className="flex space-x-1">
							<div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
							<div
								className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style={{ animationDelay: "0.1s" }}
							></div>
							<div
								className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
								style={{ animationDelay: "0.2s" }}
							></div>
						</div>
						<span className="text-sm">
							{(() => {
								const typingUsers = Object.entries(isTyping).filter(
									([userId, data]) => data.isTyping
								);
								if (typingUsers.length === 0) return "";

								// Use firstName from WebSocket data or fallback to participant data
								const typingUserNames = typingUsers.map(([userId, data]) => {
									if (data.firstName) {
										return data.firstName;
									}
									// Fallback to participant data if firstName not available
									const participant = selectedChatRoom?.participants.find(
										p => p.user.id === userId
									);
									return participant?.user.firstName || "User";
								});

								if (typingUserNames.length === 1) {
									return `${typingUserNames[0]} is typing...`;
								} else if (typingUserNames.length === 2) {
									return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
								} else {
									return `${typingUserNames[0]} and ${typingUserNames.length - 1} others are typing...`;
								}
							})()}
						</span>
					</div>
				)}

				</ChatMediaLoadProvider>
			</div>

			{/* Send form hidden for archived LOAD shipments (read-only history) */}
			{!isLoadArchivedReadOnlyChat && (
				<ChatBoxSendForm
					ref={sendFormRef}
					chatRoomId={selectedChatRoomId}
					onSendMessage={handleSendMessage}
					onTyping={sendTyping}
					replyingTo={replyingTo || undefined}
					onCancelReply={handleCancelReply}
				/>
			)}
		</div>
		</ChatImageGalleryProvider>
	);
}
