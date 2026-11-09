"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import {
	chatMessagesQueryKey,
	hydrateChatMessagesFromCache,
	fetchChatMessagesFromApi,
	CHAT_MESSAGES_QUERY_KEY,
} from "@/lib/chatMessagesQuery";
import { isAbortError } from "@/lib/chatMessagesSingleFlight";
import { chatApi } from "@/app-api/chatApi";
import { useWebSocket } from "@/context/WebSocketContext";

const PAGE = 1;
const LIMIT = 50;

type HydrationState = {
	ready: boolean;
	needsApi: boolean;
};

const roomHasUnread = (chatRoomId: string) => {
	const room = useChatStore.getState().chatRooms.find(r => r.id === chatRoomId);
	return (room?.unreadCount ?? 0) > 0;
};

/**
 * Loads page-1 messages for the active chat room.
 * IndexedDB is the display cache; React Query orchestrates HTTP + abort on room switch.
 * RQ cache disabled (staleTime/gcTime 0).
 */
export function useChatRoomMessagesQuery(chatRoomId: string | undefined) {
	const queryClient = useQueryClient();
	const { socket } = useWebSocket();
	const setLoadingMessages = useChatStore(s => s.setLoadingMessages);
	const setError = useChatStore(s => s.setError);
	const catchUpInFlightRef = useRef(false);

	const [hydration, setHydration] = useState<HydrationState>({
		ready: false,
		needsApi: false,
	});

	useEffect(() => {
		if (!chatRoomId) {
			setHydration({ ready: false, needsApi: false });
			setLoadingMessages(false);
			return;
		}

		let cancelled = false;

		queryClient
			.cancelQueries({
				queryKey: [CHAT_MESSAGES_QUERY_KEY],
				predicate: query => query.queryKey[1] !== chatRoomId,
			})
			.catch(() => {});

		setHydration({ ready: false, needsApi: false });
		setError(null);

		(async () => {
			try {
				const { needsApi } = await hydrateChatMessagesFromCache(
					chatRoomId,
					PAGE,
					LIMIT,
					{ force: roomHasUnread(chatRoomId) }
				);
				if (!cancelled) {
					setHydration({ ready: true, needsApi });
				}
			} catch (error) {
				console.error("Failed to hydrate messages from cache:", error);
				if (!cancelled) {
					setHydration({ ready: true, needsApi: true });
				}
			}
		})().catch(error => {
			console.error("Failed to hydrate messages from cache:", error);
		});

		return () => {
			cancelled = true;
		};
	}, [chatRoomId, queryClient, setError, setLoadingMessages]);

	const query = useQuery({
		queryKey: chatMessagesQueryKey(chatRoomId ?? "", PAGE, LIMIT),
		enabled: Boolean(chatRoomId && hydration.ready && hydration.needsApi),
		queryFn: ({ signal }) =>
			fetchChatMessagesFromApi(chatRoomId!, PAGE, LIMIT, {
				signal,
				force: roomHasUnread(chatRoomId!),
			}),
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		retry: false,
		// Do not throw into the Next.js error boundary — show in-chat error state instead.
		throwOnError: false,
	});

	// WebSocket delivery is primary, but a browser can miss an event while the
	// tab/socket is suspended. Reconcile the active transcript periodically and
	// immediately when the tab becomes visible again.
	useEffect(() => {
		if (!chatRoomId || !hydration.ready) return;

		let cancelled = false;
		const catchUp = async () => {
			if (
				cancelled ||
				catchUpInFlightRef.current ||
				(typeof navigator !== "undefined" && !navigator.onLine)
			) {
				return;
			}
			catchUpInFlightRef.current = true;
			try {
				await fetchChatMessagesFromApi(chatRoomId, PAGE, LIMIT, { force: true });
			} catch (error) {
				if (!isAbortError(error)) {
					console.warn("Failed to catch up active chat messages:", error);
				}
			} finally {
				catchUpInFlightRef.current = false;
			}
		};

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") catchUp().catch(() => {});
		};
		const onChatUpdated = (data: { chatRoomId?: string }) => {
			if (data?.chatRoomId === chatRoomId) catchUp().catch(() => {});
		};
		const intervalId = window.setInterval(() => {
			if (document.visibilityState === "visible") catchUp().catch(() => {});
		}, 15_000);

		catchUp().catch(() => {});
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("focus", catchUp);
		socket?.on("chatUpdated", onChatUpdated);

		return () => {
			cancelled = true;
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener("focus", catchUp);
			socket?.off("chatUpdated", onChatUpdated);
		};
	}, [chatRoomId, hydration.ready, socket]);

	const isLoading =
		Boolean(chatRoomId) &&
		(!hydration.ready || (hydration.needsApi && query.isFetching));

	useEffect(() => {
		setLoadingMessages(isLoading);
	}, [isLoading, setLoadingMessages]);

	useEffect(() => {
		if (!chatRoomId || !query.isSuccess) return;
		const room = useChatStore.getState().chatRooms.find(r => r.id === chatRoomId);
		if (room?.type !== "LOAD" || String(room.loadStatus ?? "").trim()) return;

		let cancelled = false;
		chatApi
			.getChatRoom(chatRoomId)
			.then(fresh => {
				if (cancelled || !String(fresh.loadStatus ?? "").trim()) return;
				useChatStore.getState().updateChatRoom(chatRoomId, {
					loadStatus: fresh.loadStatus,
					referenceNumber: fresh.referenceNumber,
					isRest: fresh.isRest,
					customerTrackingHidden: fresh.customerTrackingHidden,
					restDate: fresh.restDate,
					restStartedAt: fresh.restStartedAt,
				});
			})
			.catch(() => {});

		return () => {
			cancelled = true;
		};
	}, [chatRoomId, query.isSuccess, query.dataUpdatedAt]);

	useEffect(() => {
		if (!chatRoomId || !hydration.ready) return;
		if (query.isError && hydration.needsApi && !isAbortError(query.error)) {
			const storeForRoom = useChatStore
				.getState()
				.messages.filter(m => m.chatRoomId === chatRoomId);
			if (storeForRoom.length === 0) {
				setError("Failed to load messages");
			}
		}
	}, [chatRoomId, hydration.ready, hydration.needsApi, query.isError, query.error, setError]);

	const isReady =
		Boolean(chatRoomId) &&
		hydration.ready &&
		(!hydration.needsApi || query.isSuccess || query.isError);

	return {
		isLoading,
		isReady,
		isError: query.isError && !isAbortError(query.error),
	};
}
