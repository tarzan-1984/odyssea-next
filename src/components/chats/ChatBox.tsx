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
import MessageItem from "./MessageItem";
import { ChatImageGalleryProvider } from "./ChatImageGalleryContext";
import { LoadChatDownloadProvider } from "./LoadChatDownloadContext";
import { LoadChatPhotoSelectionProvider } from "./LoadChatPhotoSelectionContext";
import { BidChatAuctionProvider } from "./BidChatAuctionContext";
import { ChatMediaLoadProvider } from "@/context/ChatMediaLoadContext";
import { removeChatMessageLocally, restoreChatMessageLocally, isDeletableChatMessage } from "@/lib/chatMessageDelete";
import { indexedDBChatService } from "@/services/IndexedDBChatService";
import { mergeChatRoomParticipants } from "@/utils/normalizeChatParticipants";
import { buildChatUserNameLookup } from "@/utils/resolveChatUserName";
import { getLatestBidPlusOneMessageIdBySender } from "@/utils/bidPlusOneMessage";
import {
	getLoadDispatchTermsUiState,
	lockDispatchTermsAccepted,
	markParticipantDispatchTermsAccepted,
	resolveDispatchTermsAccepted,
	LOAD_DISPATCH_TERMS_ACCEPT_BUTTON_LABEL,
	LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT,
} from "@/utils/loadDispatchTerms";
import { canPinChatMessages, canSelectLoadChatPhotos, canSendChatMessages } from "@/utils/roleAccess";
import { MapSearchIcon } from "@/icons";
import { isSystemMessageVisibleToRole } from "@/utils/systemMessageKind";
import ChatScrollDownIcon from "@/icons/ChatScrollDownIcon";
import PinnedMessagesBar from "./PinnedMessagesBar";

interface ChatBoxProps {
	selectedChatRoomId?: string;
	/** When known (e.g. bid card), used to disable +1 for the bid creator immediately. */
	bidOwnerId?: string | null;
	/** Explicit: current user is the bid creator — +1 stays locked. */
	disableBidPlusOne?: boolean;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
	/** Load tracking map side panel is open. */
	isLoadMapOpen?: boolean;
	/** Toggle load tracking map beside the chat. */
	onToggleLoadMap?: () => void;
	/** Fill parent width (used when map panel is open). */
	fillContainer?: boolean;
}

export default function ChatBox({
	selectedChatRoomId,
	bidOwnerId = null,
	disableBidPlusOne = false,
	webSocketChatSync,
	isLoadMapOpen = false,
	onToggleLoadMap,
	fillContainer = false,
}: ChatBoxProps) {
	const [useVirtualMessageList, setUseVirtualMessageList] = useState(true);
	const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [replyingTo, setReplyingTo] = useState<Message["replyData"] | null>(null);
	const [editingMessage, setEditingMessage] = useState<Message | null>(null);
	const [editDraftKey, setEditDraftKey] = useState(0);
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
	const isRestoringOlderScrollRef = useRef(false);
	const olderLoadStartTimerRef = useRef<number | null>(null);
	const olderScrollRestoreTimerRef = useRef<number | null>(null);
	const [suppressVirtualScrollAdjustment, setSuppressVirtualScrollAdjustment] = useState(false);
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);
	const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
	const [pinnedIndex, setPinnedIndex] = useState(0);
	const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
	const [pendingJumpId, setPendingJumpId] = useState<string | null>(null);
	const jumpScrollLockRef = useRef(false);
	const isLoadingNewerRef = useRef(false);
	const highlightTimerRef = useRef<number | null>(null);
	const pinRequestGenRef = useRef(new Map<string, number>());

	useEffect(() => {
		setUseVirtualMessageList(
			new URLSearchParams(window.location.search).get("chatVirtual") !== "0"
		);
	}, []);

	// Get current user for message display
	const currentUser = useCurrentUser();

	const handleReplyToMessage = useCallback((message: Message) => {
		setEditingMessage(null);
		setReplyingTo({
			messageId: message.id,
			avatar: message.sender.avatar,
			time: message.createdAt,
			content: message.content || "",
			senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
			fileUrl: message.fileUrl,
			fileName: message.fileName,
		});
	}, []);

	const handleCancelReply = useCallback(() => {
		setReplyingTo(null);
	}, []);

	const handleEditMessage = useCallback((message: Message) => {
		setEditingMessage(message);
		setReplyingTo(null);
		setEditDraftKey(key => key + 1);
	}, []);

	const handleCancelEdit = useCallback(() => {
		setEditingMessage(null);
	}, []);

	// Use WebSocket chat sync for real-time functionality from props
	const {
		messages,
		isLoadingMessages: loading,
		webSocketMessages: { sendTyping, isTyping },
		isUserOnline,
	} = webSocketChatSync;

	const { sendMessage: wsSendMessage, socket } = useWebSocket();
	const addMessage = useChatStore(state => state.addMessage);
	const updateMessage = useChatStore(state => state.updateMessage);
	const updateChatRoom = useChatStore(state => state.updateChatRoom);
	const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
	const [isAcceptingShipmentTerms, setIsAcceptingShipmentTerms] = useState(false);

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

	const {
		sendTextMessage,
		sendMediaMessage,
		retryOptimisticMessage,
		discardFailedOptimisticMessage,
		cancelScheduledSend,
	} = useChatOutboxSend({
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
	const chatRooms = useChatStore(state => state.chatRooms);

	const chatParticipants = React.useMemo(() => {
		if (!selectedChatRoomId) return [];
		const fromList = chatRooms.find(r => r.id === selectedChatRoomId);
		return mergeChatRoomParticipants(
			fromList?.participants ?? [],
			selectedChatRoom?.participants ?? [],
			selectedChatRoomId
		);
	}, [selectedChatRoomId, chatRooms, selectedChatRoom?.participants]);

	const isLoadArchivedReadOnlyChat =
		selectedChatRoom?.type === "LOAD" && selectedChatRoom.isLoadArchived === true;
	const isBidChat = selectedChatRoom?.type === "BID";
	const canAttachFiles = !isLoadArchivedReadOnlyChat && !isBidChat;

	const hasFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

	// Modals render in a portal, but React still bubbles their drag/paste events here.
	const isEventInsideChatBox = (event: React.SyntheticEvent) =>
		event.currentTarget instanceof HTMLElement &&
		event.target instanceof Node &&
		event.currentTarget.contains(event.target);

	const getClipboardFileName = (file: File, index: number) => {
		if (file.name) return file.name;

		const extensionByType: Record<string, string> = {
			"image/png": "png",
			"image/jpeg": "jpg",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/heic": "heic",
			"image/heif": "heif",
			"application/pdf": "pdf",
			"text/plain": "txt",
			"video/mp4": "mp4",
			"video/quicktime": "mov",
			"video/webm": "webm",
			"video/3gpp": "3gp",
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
		if (!isEventInsideChatBox(e)) return;
		e.preventDefault();
		e.stopPropagation();
		if (!canAttachFiles || !hasFileDrag(e)) return;
		dragCounterRef.current += 1;
		setIsDragOver(true);
	};

	const handleChatDragLeave = (e: React.DragEvent) => {
		if (!isEventInsideChatBox(e)) return;
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
		if (!isEventInsideChatBox(e)) return;
		e.preventDefault();
		e.stopPropagation();
		if (!canAttachFiles || !hasFileDrag(e)) return;
		e.dataTransfer.dropEffect = "copy";
	};

	const handleChatDrop = async (e: React.DragEvent) => {
		if (!isEventInsideChatBox(e)) return;
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
		if (!isEventInsideChatBox(e) || !canAttachFiles) return;

		const files = getClipboardFiles(e.clipboardData);
		if (files.length === 0) return;

		e.preventDefault();
		e.stopPropagation();
		await sendFormRef.current?.addFiles(files);
	};

	useEffect(() => {
		dragCounterRef.current = 0;
		setIsDragOver(false);
		setIsAcceptingShipmentTerms(false);
	}, [selectedChatRoomId]);
	const hasMoreMessages = useChatStore(state => state.hasMoreMessages);
	const loadMoreMessages = useChatStore(state => state.loadMoreMessages);

	// Archive-related state and actions
	const isLoadingArchivedMessages = useChatStore(state => state.isLoadingArchivedMessages);
	const isLoadingAvailableArchives = useChatStore(state => state.isLoadingAvailableArchives);
	const tryLoadNextArchivePage = useChatStore(state => state.tryLoadNextArchivePage);
	const loadInitialArchiveIfPgEmpty = useChatStore(state => state.loadInitialArchiveIfPgEmpty);
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
			return serverList
				.filter((message) =>
					isSystemMessageVisibleToRole(
						message.systemMessageKind,
						currentUser?.role,
					),
				)
				.sort(
					(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				);
		}

		return [...serverList, ...activeOptimistic]
			.filter((message) =>
				isSystemMessageVisibleToRole(
					message.systemMessageKind,
					currentUser?.role,
				),
			)
			.sort(
				(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
			);
	}, [messages, selectedChatRoomId, optimisticMessages, currentUser?.id, currentUser?.role]);

	const dispatchTermsAccepted = resolveDispatchTermsAccepted(
		[chatParticipants, selectedChatRoom?.participants],
		currentUser?.id,
		selectedChatRoomId
	);
	const loadDispatchTermsUi = getLoadDispatchTermsUiState({
		isDriver: currentUser?.role?.trim().toUpperCase() === "DRIVER",
		chatType: selectedChatRoom?.type,
		currentUserId: currentUser?.id,
		skipAppVersionCheck: true,
		dispatchTermsAccepted,
	});
	const needsLoadDispatchTermsAcceptance = loadDispatchTermsUi.showAcceptButton;
	const showAcceptShipmentTermsBar =
		needsLoadDispatchTermsAcceptance && !isLoadArchivedReadOnlyChat;
	const canSendMessages = canSendChatMessages(currentUser?.role);
	// GAST keeps the admin-like composer chrome; send stays disabled via canSendMessages.
	const hideComposer =
		isLoadArchivedReadOnlyChat || loadDispatchTermsUi.hideComposer;

	const chatUserNameLookup = React.useMemo(
		() => buildChatUserNameLookup(chatParticipants, uniqueMessages),
		[chatParticipants, uniqueMessages]
	);

	const latestBidPlusOneMessageIdBySender = React.useMemo(
		() => getLatestBidPlusOneMessageIdBySender(uniqueMessages),
		[uniqueMessages]
	);

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

	const handleScrollToBottomClick = useCallback(() => {
		const followsTail = useChatStore.getState().transcriptFollowsTail;
		if (!followsTail) {
			jumpScrollLockRef.current = false;
			setIsUserScrolledUp(false);
			pendingInitialScrollRef.current = true;
			isInitialScrollCompleteRef.current = false;
			void useChatStore.getState().returnTranscriptToTail();
			return;
		}
		setIsUserScrolledUp(false);
		scrollToBottom();
	}, [scrollToBottom]);

	const handleVirtualContentMeasured = useCallback(() => {
		if (jumpScrollLockRef.current || isRestoringOlderScrollRef.current) {
			return;
		}
		if (pendingInitialScrollRef.current || !isInitialScrollCompleteRef.current) {
			scrollToBottom();
			return;
		}
		if (!isUserScrolledUp) {
			scrollToBottom();
		}
	}, [isUserScrolledUp, scrollToBottom]);

	const handleMessagesMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		const active = document.activeElement;
		if (!(active instanceof HTMLElement) || !active.isContentEditable) return;
		if (event.currentTarget.contains(active)) return;
		active.blur();
	}, []);

	const handleMessagesWheelCapture = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
		if (!isLoadingMoreRef.current && !isRestoringOlderScrollRef.current) {
			return;
		}

		if (isRestoringOlderScrollRef.current || event.deltaY < 0) {
			event.preventDefault();
			event.stopPropagation();
		}
	}, []);

	const handleScroll = useCallback(() => {
		if (!messagesContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
		const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
		setIsUserScrolledUp(!isAtBottom);

		if (isProgrammaticScrollRef.current || !isInitialScrollCompleteRef.current) {
			return;
		}

		if (
			isAtBottom &&
			scrollHeight > clientHeight &&
			!useChatStore.getState().transcriptFollowsTail &&
			!isLoadingNewerRef.current &&
			!loading
		) {
			isLoadingNewerRef.current = true;
			void useChatStore
				.getState()
				.loadNewerMessages()
				.finally(() => {
					isLoadingNewerRef.current = false;
				});
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

			if (olderLoadStartTimerRef.current != null) {
				window.clearTimeout(olderLoadStartTimerRef.current);
			}

			olderLoadStartTimerRef.current = window.setTimeout(() => {
				olderLoadStartTimerRef.current = null;

				const container = messagesContainerRef.current;
				if (!container || container.scrollTop >= 300) {
					isLoadingMoreRef.current = false;
					setIsLoadingOlder(false);
					return;
				}

				const prevScrollHeight = container.scrollHeight;
				const prevScrollTop = container.scrollTop;
				const prevAnchor = virtualListRef.current?.getScrollAnchor() ?? null;

				const finalize = () => {
					isRestoringOlderScrollRef.current = true;
					setSuppressVirtualScrollAdjustment(true);
					isProgrammaticScrollRef.current = true;

					if (olderScrollRestoreTimerRef.current != null) {
						window.clearTimeout(olderScrollRestoreTimerRef.current);
						olderScrollRestoreTimerRef.current = null;
					}

					let restoreFrames = 0;
					const restoreScrollAnchor = () => {
						virtualListRef.current?.measure();
						requestAnimationFrame(() => {
							const newScrollHeight = container.scrollHeight;
							const delta = newScrollHeight - prevScrollHeight;
							const restoredByAnchor = prevAnchor
								? virtualListRef.current?.restoreScrollAnchor(prevAnchor) ?? false
								: false;

							if (!restoredByAnchor) {
								container.scrollTop = prevScrollTop + delta;
							}

							restoreFrames += 1;
							if (restoreFrames < 4) {
								requestAnimationFrame(restoreScrollAnchor);
								return;
							}

							olderScrollRestoreTimerRef.current = window.setTimeout(() => {
								isRestoringOlderScrollRef.current = false;
								setSuppressVirtualScrollAdjustment(false);
								isProgrammaticScrollRef.current = false;
								isLoadingMoreRef.current = false;
								setIsLoadingOlder(false);
								virtualListRef.current?.measure();
								olderScrollRestoreTimerRef.current = null;
							}, 240);
						});
					};

					requestAnimationFrame(restoreScrollAnchor);
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
			}, 160);
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
			isRestoringOlderScrollRef.current = false;
			if (olderLoadStartTimerRef.current != null) {
				window.clearTimeout(olderLoadStartTimerRef.current);
				olderLoadStartTimerRef.current = null;
			}
			if (olderScrollRestoreTimerRef.current != null) {
				window.clearTimeout(olderScrollRestoreTimerRef.current);
				olderScrollRestoreTimerRef.current = null;
			}
			pendingInitialScrollRef.current = true;
			setSuppressVirtualScrollAdjustment(false);
			setIsLoadingOlder(false);
			setIsUserScrolledUp(false);
		}
		setReplyingTo(null);
		setEditingMessage(null);
		setPinnedMessages([]);
		setPinnedIndex(0);
		setHighlightedMessageId(null);
		setPendingJumpId(null);
		jumpScrollLockRef.current = false;
	}, [selectedChatRoomId]);

	useEffect(() => {
		return () => {
			if (olderLoadStartTimerRef.current != null) {
				window.clearTimeout(olderLoadStartTimerRef.current);
			}
			if (olderScrollRestoreTimerRef.current != null) {
				window.clearTimeout(olderScrollRestoreTimerRef.current);
			}
			if (highlightTimerRef.current != null) {
				window.clearTimeout(highlightTimerRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!selectedChatRoomId) return;
		let cancelled = false;
		chatApi
			.getPinnedMessages(selectedChatRoomId)
			.then(list => {
				if (cancelled) return;
				setPinnedMessages(list);
				setPinnedIndex(0);
				for (const pinned of list) {
					updateMessage(pinned.id, { pinnedAt: pinned.pinnedAt ?? null });
				}
			})
			.catch(error => {
				console.error("Failed to load pinned messages:", error);
			});
		return () => {
			cancelled = true;
		};
	}, [selectedChatRoomId, updateMessage]);

	useEffect(() => {
		if (!socket) return;

		const onPinned = (data: {
			chatRoomId: string;
			messageId: string;
			pinnedAt: string | null;
			message?: Message;
		}) => {
			if (!data?.chatRoomId || !data.messageId) return;
			if (data.chatRoomId !== selectedChatRoomId) return;
			if (pinRequestGenRef.current.has(data.messageId)) return;
			updateMessage(data.messageId, { pinnedAt: data.pinnedAt });
			setPinnedMessages(prev => {
				if (!data.pinnedAt) {
					return prev.filter(message => message.id !== data.messageId);
				}
				const next = data.message
					? { ...data.message, pinnedAt: data.pinnedAt }
					: prev.find(message => message.id === data.messageId);
				if (!next) return prev;
				const without = prev.filter(message => message.id !== data.messageId);
				return [...without, { ...next, pinnedAt: data.pinnedAt }].sort((a, b) =>
					String(b.pinnedAt).localeCompare(String(a.pinnedAt))
				);
			});
		};

		const onDeleted = (data: { messageId: string; chatRoomId: string }) => {
			if (data?.chatRoomId !== selectedChatRoomId) return;
			setPinnedMessages(prev => prev.filter(message => message.id !== data.messageId));
		};

		socket.on("messagePinned", onPinned);
		socket.on("messageDeleted", onDeleted);
		return () => {
			socket.off("messagePinned", onPinned);
			socket.off("messageDeleted", onDeleted);
		};
	}, [socket, selectedChatRoomId, updateMessage]);

	const revealMessage = useCallback((messageId: string) => {
		jumpScrollLockRef.current = true;
		setIsUserScrolledUp(true);
		isProgrammaticScrollRef.current = true;
		const scrolled = virtualListRef.current?.scrollToMessage(messageId) ?? false;
		if (!scrolled && messagesContainerRef.current) {
			const node = messagesContainerRef.current.querySelector(
				`[data-message-id="${CSS.escape(messageId)}"]`
			);
			node?.scrollIntoView({ block: "center" });
		}
		setHighlightedMessageId(messageId);
		if (highlightTimerRef.current != null) {
			window.clearTimeout(highlightTimerRef.current);
		}
		highlightTimerRef.current = window.setTimeout(() => {
			setHighlightedMessageId(current => (current === messageId ? null : current));
			highlightTimerRef.current = null;
		}, 1600);
		window.setTimeout(() => {
			jumpScrollLockRef.current = false;
			isProgrammaticScrollRef.current = false;
		}, 400);
	}, []);

	useLayoutEffect(() => {
		if (!pendingJumpId) return;
		if (!uniqueMessages.some(message => message.id === pendingJumpId)) return;
		const messageId = pendingJumpId;
		setPendingJumpId(null);
		revealMessage(messageId);
	}, [pendingJumpId, uniqueMessages, revealMessage]);

	const jumpToMessage = useCallback(
		async (messageId: string) => {
			if (!selectedChatRoomId) return;
			const loaded = useChatStore
				.getState()
				.messages.some(
					message => message.id === messageId && message.chatRoomId === selectedChatRoomId
				);
			if (loaded) {
				setPendingJumpId(messageId);
				return;
			}

			jumpScrollLockRef.current = true;
			setIsUserScrolledUp(true);
			try {
				const around = await chatApi.getMessagesAround(selectedChatRoomId, messageId);
				if (!around.messages.some(message => message.id === messageId)) {
					jumpScrollLockRef.current = false;
					return;
				}
				useChatStore
					.getState()
					.showTranscriptAround(
						around.messages,
						around.hasMoreBefore,
						around.hasMoreAfter
					);
				setPendingJumpId(messageId);
			} catch (error) {
				jumpScrollLockRef.current = false;
				console.error("Failed to open pinned message:", error);
				chatApi
					.getPinnedMessages(selectedChatRoomId)
					.then(setPinnedMessages)
					.catch(() => undefined);
			}
		},
		[selectedChatRoomId]
	);

	const handlePinnedBarClick = useCallback(() => {
		if (pinnedMessages.length === 0) return;
		const index = ((pinnedIndex % pinnedMessages.length) + pinnedMessages.length) % pinnedMessages.length;
		const message = pinnedMessages[index];
		if (!message) return;
		setPinnedIndex((index + 1) % pinnedMessages.length);
		void jumpToMessage(message.id);
	}, [jumpToMessage, pinnedIndex, pinnedMessages]);

	const handleTogglePin = useCallback(
		(message: Message, pinned?: boolean) => {
			const nextPinned = pinned ?? !message.pinnedAt;
			const previous = message.pinnedAt ?? null;
			const optimisticAt = nextPinned ? new Date().toISOString() : null;

			updateMessage(message.id, {
				pinnedAt: optimisticAt,
				...(nextPinned ? { isArchivedMessage: false } : {}),
			});
			setPinnedMessages(prev => {
				const without = prev.filter(item => item.id !== message.id);
				if (!optimisticAt) return without;
				return [{ ...message, pinnedAt: optimisticAt }, ...without];
			});
			if (optimisticAt) setPinnedIndex(0);

			const requestGen = (pinRequestGenRef.current.get(message.id) ?? 0) + 1;
			pinRequestGenRef.current.set(message.id, requestGen);
			void chatApi
				.setMessagePinned(message.id, nextPinned, {
					chatRoomId: message.chatRoomId,
					createdAt: message.createdAt,
				})
				.then(updated => {
					if (pinRequestGenRef.current.get(message.id) !== requestGen) return;
					const pinnedAt = updated.pinnedAt ?? null;
					updateMessage(message.id, {
						pinnedAt,
						...(pinnedAt ? { isArchivedMessage: false } : {}),
					});
					setPinnedMessages(prev =>
						prev.map(item => (item.id === message.id ? { ...item, pinnedAt } : item))
					);
				})
				.catch(error => {
					if (pinRequestGenRef.current.get(message.id) !== requestGen) return;
					updateMessage(message.id, { pinnedAt: previous });
					setPinnedMessages(prev => {
						const without = prev.filter(item => item.id !== message.id);
						if (!previous) return without;
						return [{ ...message, pinnedAt: previous }, ...without].sort((a, b) =>
							String(b.pinnedAt).localeCompare(String(a.pinnedAt))
						);
					});
					console.error("Failed to pin message:", error);
				})
				.finally(() => {
					if (pinRequestGenRef.current.get(message.id) === requestGen) {
						pinRequestGenRef.current.delete(message.id);
					}
				});
		},
		[updateMessage]
	);

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
			!pendingInitialScrollRef.current &&
			!isRestoringOlderScrollRef.current &&
			!jumpScrollLockRef.current
		) {
			scrollToBottom();
		}
	}, [uniqueMessages.length, isUserScrolledUp, scrollToBottom]);

	const handleSendMessage = async (messageData: {
		content: string;
		fileData?: { fileUrl: string; key: string; fileName: string; fileSize: number }[];
		replyData?: Message["replyData"];
	}) => {
		if (!selectedChatRoom || loadDispatchTermsUi.hideComposer || !canSendMessages) return;

		try {
			sendTyping(false);

			if (editingMessage) {
				const content = messageData.content.trim();
				if (!content) return;

				const previousMessage = editingMessage;
				const previousLastMessage = selectedChatRoom.lastMessage;
				updateMessage(previousMessage.id, { content });
				if (previousLastMessage?.id === previousMessage.id) {
					updateChatRoom(selectedChatRoom.id, {
						lastMessage: {
							...previousLastMessage,
							content,
						},
					});
				}

				try {
					const updatedMessage = await chatApi.updateMessage(previousMessage.id, content);
					updateMessage(updatedMessage.id, updatedMessage);
					const state = useChatStore.getState();
					const room = state.chatRooms.find(r => r.id === updatedMessage.chatRoomId);
					if (room?.lastMessage?.id === updatedMessage.id) {
						updateChatRoom(updatedMessage.chatRoomId, {
							lastMessage: {
								...room.lastMessage,
								...updatedMessage,
							},
						});
					}
					setEditingMessage(null);
				} catch (error) {
					updateMessage(previousMessage.id, previousMessage);
					if (previousLastMessage?.id === previousMessage.id) {
						updateChatRoom(selectedChatRoom.id, {
							lastMessage: previousLastMessage,
						});
					}
					throw error;
				}
				return;
			}

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
			throw err;
		}
	};

	const handleAcceptShipmentTerms = async () => {
		if (isAcceptingShipmentTerms || !needsLoadDispatchTermsAcceptance) return;

		setIsAcceptingShipmentTerms(true);
		try {
			await sendTextMessage(LOAD_DISPATCH_TERMS_ACCEPTED_CONTENT);
			if (selectedChatRoom && currentUser?.id) {
				lockDispatchTermsAccepted(selectedChatRoom.id, currentUser.id);
				const participants = markParticipantDispatchTermsAccepted(
					chatParticipants.length
						? chatParticipants
						: selectedChatRoom.participants,
					currentUser.id
				);
				if (participants) {
					updateChatRoom(selectedChatRoom.id, { participants });
					void indexedDBChatService.updateChatRoom(selectedChatRoom.id, {
						participants,
					});
				}
			}
			setTimeout(() => {
				scrollToBottom();
			}, 50);
		} catch (err) {
			console.error("Failed to accept shipment terms:", err);
		} finally {
			setIsAcceptingShipmentTerms(false);
		}
	};

	// Handle message dropdown actions
	const handleDeleteMessage = async (messageId: string) => {
		const state = useChatStore.getState();
		const targetMessage = state.messages.find(msg => msg.id === messageId);
		if (!targetMessage || !isDeletableChatMessage(targetMessage)) {
			return;
		}

		const snapshot = removeChatMessageLocally(messageId);
		if (!snapshot) {
			return;
		}

		try {
			const deleteParams = new URLSearchParams();
			if (targetMessage.chatRoomId) {
				deleteParams.set("chatRoomId", targetMessage.chatRoomId);
			}
			if (targetMessage.createdAt) {
				deleteParams.set("createdAt", targetMessage.createdAt);
			}
			const deleteQuery = deleteParams.toString();
			const response = await fetch(
				`/api/messages/${messageId}${deleteQuery ? `?${deleteQuery}` : ""}`,
				{
					method: "DELETE",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
					},
				}
			);

			if (response.status === 404) {
				// Already removed from DB (e.g. archived to S3) — keep local removal.
				return;
			}

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				restoreChatMessageLocally(snapshot);
				console.warn(
					"Failed to delete message:",
					errorData.error || errorData.message || response.statusText
				);
			}
		} catch (error) {
			restoreChatMessageLocally(snapshot);
			console.warn("Failed to delete message:", error);
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
			<div
				className={`flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${
					fillContainer ? "w-full" : "xl:w-3/4"
				}`}
			>
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

	const loadReferenceNumber =
		selectedChatRoom.type === "LOAD" ? selectedChatRoom.referenceNumber : null;

	return (
		<BidChatAuctionProvider chatRoomId={selectedChatRoomId} enabled={isBidChat}>
		<LoadChatDownloadProvider referenceNumber={loadReferenceNumber}>
		<LoadChatPhotoSelectionProvider
			enabled={
				selectedChatRoom.type === "LOAD" && canSelectLoadChatPhotos(currentUser?.role)
			}
			roomId={selectedChatRoomId ?? ""}
			loadId={selectedChatRoom.loadId != null ? String(selectedChatRoom.loadId) : ""}
		>
		<ChatImageGalleryProvider messages={uniqueMessages}>
			<div
				data-chat-box
				className={`@container/size relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${
					fillContainer ? "w-full" : "xl:w-3/4"
				}`}
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

				<PinnedMessagesBar
					messages={pinnedMessages}
					activeIndex={pinnedIndex}
					canUnpin={canPinChatMessages(currentUser?.role, selectedChatRoom?.type)}
					onClick={handlePinnedBarClick}
					onUnpin={message => handleTogglePin(message, false)}
				/>

				{/* Messages */}
				<div className="relative min-h-0 flex-1">
					{selectedChatRoom?.type === "LOAD" &&
					selectedChatRoom.loadId?.trim() &&
					onToggleLoadMap ? (
						<button
							type="button"
							onClick={onToggleLoadMap}
							className={`absolute right-4 top-4 z-20 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 xl:right-5 xl:top-5 ${
								isLoadMapOpen
									? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400"
									: "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400"
							}`}
							aria-label={isLoadMapOpen ? "Close map" : "Open map"}
							aria-pressed={isLoadMapOpen}
							title={isLoadMapOpen ? "Close map" : "Open map"}
						>
							<MapSearchIcon className="h-5 w-5" />
						</button>
					) : null}
					<div
						ref={attachMessagesContainer}
						onScroll={handleScroll}
						onWheelCapture={handleMessagesWheelCapture}
						onMouseDown={handleMessagesMouseDown}
						className="relative h-full max-h-full overflow-auto p-5 custom-scrollbar xl:p-6"
						style={{ overflowAnchor: "none" }}
					>
					<ChatMediaLoadProvider
						mediaLoadEnabled={messagesReady}
						scrollRoot={messagesScrollRoot}
					>
						{/* Loading indicator for older messages */}
						{(isLoadingOlder || isLoadingArchivedMessages) &&
							uniqueMessages.length > 0 && (
								<div className="pointer-events-none absolute left-0 right-0 top-3 z-10 flex items-center justify-center">
									<div className="flex items-center space-x-2 rounded-full border border-gray-200 bg-white/95 px-3 py-1.5 text-gray-500 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95 dark:text-gray-400">
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
						) : useVirtualMessageList ? (
							<ChatBoxVirtualMessageList
								ref={virtualListRef}
								messages={uniqueMessages}
								currentUser={currentUser}
								chatRoomType={selectedChatRoom?.type}
								chatParticipants={chatParticipants}
								chatUserNameLookup={chatUserNameLookup}
								latestBidPlusOneMessageIdBySender={latestBidPlusOneMessageIdBySender}
								scrollElement={messagesScrollRoot}
								onContentMeasured={handleVirtualContentMeasured}
								isUserScrolledUp={isUserScrolledUp}
								suppressScrollAdjustment={suppressVirtualScrollAdjustment}
								onDelete={handleDeleteMessage}
								onEdit={handleEditMessage}
								onReply={handleReplyToMessage}
								onMarkUnread={handleMarkMessageUnread}
								onTogglePin={handleTogglePin}
								highlightedMessageId={highlightedMessageId}
								onRetry={message => {
									retryOptimisticMessage(message).catch(error => {
										console.error("Failed to retry message:", error);
									});
								}}
								onDiscardFailed={message => {
									discardFailedOptimisticMessage(message).catch(error => {
										console.error("Failed to discard message:", error);
									});
								}}
								onUndoSend={message => {
									cancelScheduledSend(message).catch(error => {
										console.error("Failed to undo send:", error);
									});
								}}
							/>
						) : (
							<div className="flex flex-col gap-6" data-chat-list-mode="plain">
								{uniqueMessages.map(message => (
									<MessageItem
										key={message.id}
										message={message}
										currentUser={currentUser}
										chatRoomType={selectedChatRoom?.type}
										chatParticipants={chatParticipants}
										chatUserNameLookup={chatUserNameLookup}
										latestBidPlusOneMessageIdBySender={
											latestBidPlusOneMessageIdBySender
										}
										onDelete={handleDeleteMessage}
										onEdit={handleEditMessage}
										onReply={handleReplyToMessage}
										onMarkUnread={handleMarkMessageUnread}
										onTogglePin={handleTogglePin}
										highlighted={message.id === highlightedMessageId}
										onRetry={
											message.pendingOutgoing?.status === "failed"
												? () => {
														retryOptimisticMessage(message).catch(
															error => {
																console.error(
																	"Failed to retry message:",
																	error
																);
															}
														);
													}
												: undefined
										}
										onDiscardFailed={
											message.pendingOutgoing?.status === "failed"
												? () => {
														discardFailedOptimisticMessage(
															message
														).catch(error => {
															console.error(
																"Failed to discard message:",
																error
															);
														});
													}
												: undefined
										}
										onUndoSend={
											message.pendingOutgoing?.status === "scheduled"
												? () => {
														cancelScheduledSend(message).catch(error => {
															console.error(
																"Failed to undo send:",
																error
															);
														});
													}
												: undefined
										}
									/>
								))}
							</div>
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
										const typingUserNames = typingUsers.map(
											([userId, data]) => {
												if (data.firstName) {
													return data.firstName;
												}
												// Fallback to participant data if firstName not available
												const participant =
													selectedChatRoom?.participants.find(
														p => p.user.id === userId
													);
												return participant?.user.firstName || "User";
											}
										);

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
					{isUserScrolledUp && uniqueMessages.length > 0 && (
						<button
							type="button"
							onClick={handleScrollToBottomClick}
							className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-md transition hover:text-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white xl:bottom-4 xl:right-4"
							aria-label="Scroll to latest messages"
						>
							<ChatScrollDownIcon className="h-10 w-10" />
						</button>
					)}
				</div>

				{/* Accept terms CTA replaces composer until driver accepts; archived LOAD stays read-only */}
				{showAcceptShipmentTermsBar ? (
					<div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-4 shadow-[0_0_40px_rgba(41,41,102,0.2)] dark:border-gray-800 dark:bg-gray-950/95">
						<button
							type="button"
							onClick={handleAcceptShipmentTerms}
							disabled={isAcceptingShipmentTerms}
							className="w-full rounded-lg bg-brand-500 px-3 py-3.5 text-base font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{LOAD_DISPATCH_TERMS_ACCEPT_BUTTON_LABEL}
						</button>
					</div>
				) : !hideComposer ? (
					<ChatBoxSendForm
						ref={sendFormRef}
						chatRoomId={selectedChatRoomId}
						onSendMessage={handleSendMessage}
						onTyping={sendTyping}
						replyingTo={replyingTo || undefined}
						onCancelReply={handleCancelReply}
						editingMessage={editingMessage}
						editDraftKey={editDraftKey}
						onCancelEdit={handleCancelEdit}
						isBidChat={isBidChat}
						bidOwnerId={bidOwnerId}
						disableBidPlusOne={disableBidPlusOne}
						disabled={!canSendMessages}
					/>
				) : null}
			</div>
		</ChatImageGalleryProvider>
		</LoadChatPhotoSelectionProvider>
		</LoadChatDownloadProvider>
		</BidChatAuctionProvider>
	);
}
