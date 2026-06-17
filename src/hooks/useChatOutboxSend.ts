"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import type { ChatMessageAttachment, Message, User } from "@/app-api/chatApi";
import {
	chatOutboxService,
	createClientMessageId,
	type ChatOutboxItem,
	type OutboxUploadedAttachment,
} from "@/services/chatOutboxService";
import {
	createOptimisticMediaMessage,
	createOptimisticTextMessage,
	messageReplacesOptimistic,
	outboxItemToOptimisticMessage,
	patchOptimisticMessage,
	removeOptimisticByClientMessageId,
} from "@/utils/optimisticChatMessage";
import { ODYSSEA_WS_RECONNECTED_EVENT } from "@/lib/websocketSyncEvents";
import { runBrowserAccessTokenRefresh } from "@/utils/accessTokenRefresh";
import { useChatStore } from "@/stores/chatStore";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

const SEND_ACK_TIMEOUT_MS = 15_000;

export type OutboundSendFn = (
	content: string,
	fileData?: { fileUrl: string; fileName: string; fileSize: number },
	replyData?: Message["replyData"],
	attachments?: { fileUrl: string; fileName: string; fileSize?: number }[],
	clientMessageId?: string
) => Promise<void>;

export type OutboundHttpSendFn = (item: ChatOutboxItem) => Promise<Message>;

type Params = {
	chatRoomId?: string;
	sender?: User;
	isConnected: boolean;
	socket: Socket | null;
	sendMessage: OutboundSendFn;
	sendMessageHttp: OutboundHttpSendFn;
	optimisticMessages: Message[];
	setOptimisticMessages: Dispatch<SetStateAction<Message[]>>;
	serverMessages: Message[];
	currentUserId?: string;
};

function attachmentsToOutboxUploaded(
	attachments: ChatMessageAttachment[]
): OutboxUploadedAttachment[] {
	return attachments.map(file => ({
		fileUrl: file.fileUrl,
		fileName: file.fileName,
		fileSize: file.fileSize ?? 0,
	}));
}

export function useChatOutboxSend({
	chatRoomId,
	sender,
	socket,
	sendMessage,
	sendMessageHttp,
	optimisticMessages,
	setOptimisticMessages,
	serverMessages,
	currentUserId,
}: Params) {
	const inFlightRef = useRef<Set<string>>(new Set());
	const awaitingAckRef = useRef<Set<string>>(new Set());
	const ackTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	const optimisticMessagesRef = useRef(optimisticMessages);

	useEffect(() => {
		optimisticMessagesRef.current = optimisticMessages;
	}, [optimisticMessages]);

	const markOptimisticFailed = useCallback(
		(clientMessageId: string) => {
			chatOutboxService.markFailed(clientMessageId).catch(() => {});
			awaitingAckRef.current.delete(clientMessageId);
			setOptimisticMessages(prev =>
				prev.map(msg =>
					msg.pendingOutgoing?.clientMessageId === clientMessageId
						? patchOptimisticMessage(msg, { status: "failed" })
						: msg
				)
			);
		},
		[setOptimisticMessages]
	);

	const clearAckTimer = useCallback((clientMessageId: string) => {
		const timer = ackTimersRef.current.get(clientMessageId);
		if (timer) {
			clearTimeout(timer);
			ackTimersRef.current.delete(clientMessageId);
		}
	}, []);

	const removeConfirmedOptimistic = useCallback(
		async (clientMessageId: string) => {
			clearAckTimer(clientMessageId);
			inFlightRef.current.delete(clientMessageId);
			awaitingAckRef.current.delete(clientMessageId);
			await chatOutboxService.remove(clientMessageId);
			setOptimisticMessages(prev => removeOptimisticByClientMessageId(prev, clientMessageId));
		},
		[clearAckTimer, setOptimisticMessages]
	);

	const tryHttpFallback = useCallback(
		async (clientMessageId: string): Promise<boolean> => {
			const item = (await chatOutboxService.getAll()).find(
				row => row.clientMessageId === clientMessageId
			);
			if (!item) return false;
			try {
				await sendMessageHttp(item);
				await removeConfirmedOptimistic(clientMessageId);
				return true;
			} catch (error) {
				console.error("[useChatOutboxSend] HTTP fallback failed:", error);
				return false;
			}
		},
		[sendMessageHttp, removeConfirmedOptimistic]
	);

	const scheduleAckTimeout = useCallback(
		(clientMessageId: string) => {
			clearAckTimer(clientMessageId);
			const timer = setTimeout(() => {
				ackTimersRef.current.delete(clientMessageId);
				void (async () => {
					const recovered = await tryHttpFallback(clientMessageId);
					if (!recovered) {
						markOptimisticFailed(clientMessageId);
					}
				})();
			}, SEND_ACK_TIMEOUT_MS);
			ackTimersRef.current.set(clientMessageId, timer);
		},
		[clearAckTimer, markOptimisticFailed, tryHttpFallback]
	);

	const dispatchOutboxSend = useCallback(
		async (item: ChatOutboxItem) => {
			if (!chatRoomId || !sender) return;
			if (inFlightRef.current.has(item.clientMessageId)) return;
			inFlightRef.current.add(item.clientMessageId);

			try {
				const uploaded = item.uploadedAttachments;

				if (item.kind === "media") {
					if (!uploaded?.length) {
						throw new Error("Missing uploaded attachments for media message");
					}

					if (uploaded.length >= 2) {
						await sendMessage(
							item.content,
							undefined,
							item.replyData,
							uploaded,
							item.clientMessageId
						);
					} else {
						await sendMessage(
							item.content,
							uploaded[0],
							item.replyData,
							undefined,
							item.clientMessageId
						);
					}
				} else {
					await sendMessage(
						item.content,
						undefined,
						item.replyData,
						undefined,
						item.clientMessageId
					);
				}

				await chatOutboxService.patch(item.clientMessageId, { status: "sending" });
				setOptimisticMessages(prev =>
					prev.map(msg =>
						msg.pendingOutgoing?.clientMessageId === item.clientMessageId
							? patchOptimisticMessage(msg, { status: "sending" })
							: msg
					)
				);
				awaitingAckRef.current.add(item.clientMessageId);
				scheduleAckTimeout(item.clientMessageId);
			} catch (error) {
				console.error("[useChatOutboxSend] WebSocket dispatch failed:", error);
				const recovered = await tryHttpFallback(item.clientMessageId);
				if (!recovered) {
					markOptimisticFailed(item.clientMessageId);
				}
				if (!recovered) {
					throw error;
				}
			} finally {
				inFlightRef.current.delete(item.clientMessageId);
			}
		},
		[chatRoomId, sender, sendMessage, markOptimisticFailed, scheduleAckTimeout, setOptimisticMessages, tryHttpFallback]
	);

	const sendTextMessage = useCallback(
		async (content: string, replyData?: Message["replyData"]) => {
			if (!chatRoomId || !sender) return;

			const clientMessageId = createClientMessageId();
			const optimistic = createOptimisticTextMessage({
				clientMessageId,
				chatRoomId,
				sender,
				content,
				replyData,
			});

			setOptimisticMessages(prev => [...prev, optimistic]);

			const outboxItem: ChatOutboxItem = {
				clientMessageId,
				chatRoomId,
				kind: "text",
				content,
				replyData,
				status: "sending",
				createdAt: optimistic.createdAt,
				retryCount: 0,
			};

			await chatOutboxService.upsert(outboxItem);
			dispatchOutboxSend(outboxItem).catch(() => {});
		},
		[chatRoomId, sender, dispatchOutboxSend, setOptimisticMessages]
	);

	const sendMediaMessage = useCallback(
		async (
			content: string,
			attachments: ChatMessageAttachment[],
			replyData?: Message["replyData"]
		) => {
			if (!chatRoomId || !sender || attachments.length === 0) return;

			const clientMessageId = createClientMessageId();
			const optimistic = createOptimisticMediaMessage({
				clientMessageId,
				chatRoomId,
				sender,
				content,
				attachments,
				replyData,
			});

			setOptimisticMessages(prev => [...prev, optimistic]);

			const outboxItem: ChatOutboxItem = {
				clientMessageId,
				chatRoomId,
				kind: "media",
				content,
				replyData,
				uploadedAttachments: attachmentsToOutboxUploaded(attachments),
				status: "sending",
				createdAt: optimistic.createdAt,
				retryCount: 0,
			};

			await chatOutboxService.upsert(outboxItem);
			dispatchOutboxSend(outboxItem).catch(() => {});
		},
		[chatRoomId, sender, dispatchOutboxSend, setOptimisticMessages]
	);

	const retryOptimisticMessage = useCallback(
		async (message: Message) => {
			const clientMessageId = message.pendingOutgoing?.clientMessageId;
			if (!clientMessageId || !chatRoomId) return;

			const item = (await chatOutboxService.getAll()).find(
				row => row.clientMessageId === clientMessageId
			);
			if (!item) return;

			await chatOutboxService.patch(clientMessageId, { status: "sending" });
			setOptimisticMessages(prev =>
				prev.map(msg =>
					msg.pendingOutgoing?.clientMessageId === clientMessageId
						? patchOptimisticMessage(msg, { status: "sending" })
						: msg
				)
			);
			await dispatchOutboxSend({ ...item, status: "sending" });
		},
		[chatRoomId, dispatchOutboxSend, setOptimisticMessages]
	);

	const hydrateRoomOutbox = useCallback(async (retryFailed = false) => {
		if (!chatRoomId || !sender) return;
		const items = await chatOutboxService.getForRoom(chatRoomId);
		if (items.length === 0) return;

		setOptimisticMessages(prev => {
			const existingIds = new Set(
				prev.map(msg => msg.pendingOutgoing?.clientMessageId).filter(Boolean)
			);
			const fromOutbox = items
				.filter(item => !existingIds.has(item.clientMessageId))
				.map(item => outboxItemToOptimisticMessage(item, sender));
			return fromOutbox.length > 0 ? [...prev, ...fromOutbox] : prev;
		});

		for (const item of items) {
			if (item.serverMessageId || awaitingAckRef.current.has(item.clientMessageId)) {
				continue;
			}
			const shouldRetry =
				item.status === "uploading" ||
				item.status === "sending" ||
				(retryFailed && item.status === "failed");
			if (shouldRetry) {
				dispatchOutboxSend({ ...item, status: "sending" }).catch(() => {});
			}
		}
	}, [chatRoomId, sender, dispatchOutboxSend, setOptimisticMessages]);

	useEffect(() => {
		hydrateRoomOutbox(false).catch(() => {});
	}, [hydrateRoomOutbox]);

	useEffect(() => {
		if (!currentUserId || optimisticMessages.length === 0) return;
		const confirmed = optimisticMessages.filter(opt =>
			messageReplacesOptimistic(opt, serverMessages, currentUserId)
		);
		if (confirmed.length === 0) return;
		Promise.all(
			confirmed.map(msg => removeConfirmedOptimistic(msg.pendingOutgoing!.clientMessageId))
		).catch(() => {});
	}, [serverMessages, optimisticMessages, currentUserId, removeConfirmedOptimistic]);

	useEffect(() => {
		if (!socket || !chatRoomId) return;

		const resolveClientMessageId = (data: {
			clientMessageId?: string;
			messageId?: string;
			message?: Message;
		}): string | null => {
			if (data.clientMessageId) return data.clientMessageId;
			if (data.message?.clientMessageId) return data.message.clientMessageId;
			const pending = optimisticMessagesRef.current.filter(
				msg =>
					msg.chatRoomId === chatRoomId &&
					msg.pendingOutgoing &&
					(msg.pendingOutgoing.status === "sending" ||
						msg.pendingOutgoing.status === "uploading" ||
						msg.pendingOutgoing.status === "acknowledged")
			);
			if (pending.length !== 1) return null;
			return pending[0].pendingOutgoing?.clientMessageId ?? null;
		};

		const onMessageSent = (data: {
			chatRoomId?: string;
			clientMessageId?: string;
			messageId?: string;
			message?: Message;
		}) => {
			if (data?.chatRoomId !== chatRoomId || !data.messageId) return;
			const clientMessageId = resolveClientMessageId(data);
			if (!clientMessageId) return;

			clearAckTimer(clientMessageId);
			chatOutboxService.markAcknowledged(clientMessageId, data.messageId).catch(() => {});

			if (data.message) {
				const serverMessage: Message = {
					...data.message,
					createdAt:
						typeof data.message.createdAt === "string"
							? data.message.createdAt
							: new Date(data.message.createdAt).toISOString(),
				};
				useChatStore.getState().addMessage(serverMessage);
				indexedDBChatService.addMessage(serverMessage).catch(() => {});
			}

			removeConfirmedOptimistic(clientMessageId).catch(() => {});
		};

		const onSocketError = (error: { message?: string; details?: string }) => {
			if (error?.message !== "Failed to send message") return;
			const isAuthError =
				error.details?.toLowerCase().includes("unauthorized") ||
				error.details?.toLowerCase().includes("jwt") ||
				error.details?.toLowerCase().includes("token");
			if (isAuthError) {
				runBrowserAccessTokenRefresh().catch(() => {});
			}
			for (const clientMessageId of [...awaitingAckRef.current]) {
				const pending = optimisticMessagesRef.current.find(
					msg => msg.pendingOutgoing?.clientMessageId === clientMessageId
				);
				if (pending?.chatRoomId !== chatRoomId) continue;
				void (async () => {
					const recovered = await tryHttpFallback(clientMessageId);
					if (!recovered) {
						markOptimisticFailed(clientMessageId);
					}
				})();
			}
		};

		const onNewMessage = (
			data:
				| { chatRoomId?: string; message?: Message }
				| [{ chatRoomId?: string; message?: Message }]
		) => {
			const messageData = Array.isArray(data) ? data[0] : data;
			if (messageData?.chatRoomId !== chatRoomId || !messageData.message) return;
			if (messageData.message.senderId !== currentUserId) return;

			const clientMessageId = messageData.message.clientMessageId;
			if (clientMessageId) {
				clearAckTimer(clientMessageId);
				const hasOptimistic = optimisticMessagesRef.current.some(
					msg => msg.pendingOutgoing?.clientMessageId === clientMessageId
				);
				if (hasOptimistic) {
					removeConfirmedOptimistic(clientMessageId).catch(() => {});
				}
				return;
			}

			const optimistic = optimisticMessagesRef.current.find(
				msg => msg.pendingOutgoing?.serverMessageId === messageData.message!.id
			);
			if (optimistic?.pendingOutgoing?.clientMessageId) {
				clearAckTimer(optimistic.pendingOutgoing.clientMessageId);
				removeConfirmedOptimistic(optimistic.pendingOutgoing.clientMessageId).catch(() => {});
			}
		};

		socket.on("messageSent", onMessageSent);
		socket.on("newMessage", onNewMessage);
		socket.on("error", onSocketError);
		return () => {
			socket.off("messageSent", onMessageSent);
			socket.off("newMessage", onNewMessage);
			socket.off("error", onSocketError);
		};
	}, [
		socket,
		chatRoomId,
		currentUserId,
		clearAckTimer,
		removeConfirmedOptimistic,
		markOptimisticFailed,
		tryHttpFallback,
	]);

	useEffect(() => {
		const onWsReconnected = () => {
			hydrateRoomOutbox(true).catch(() => {});
		};
		window.addEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
		return () => window.removeEventListener(ODYSSEA_WS_RECONNECTED_EVENT, onWsReconnected);
	}, [hydrateRoomOutbox]);

	useEffect(() => {
		return () => {
			for (const timer of ackTimersRef.current.values()) {
				clearTimeout(timer);
			}
			ackTimersRef.current.clear();
		};
	}, []);

	return {
		sendTextMessage,
		sendMediaMessage,
		retryOptimisticMessage,
	};
}
