"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "@/stores/chatStore";
import {
	chatMessagesQueryKey,
	hydrateChatMessagesFromCache,
	fetchChatMessagesFromApi,
	CHAT_MESSAGES_QUERY_KEY,
} from "@/lib/chatMessagesQuery";
import { isAbortError } from "@/lib/chatMessagesSingleFlight";

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
	const setLoadingMessages = useChatStore(s => s.setLoadingMessages);
	const setError = useChatStore(s => s.setError);

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

		void queryClient.cancelQueries({
			queryKey: [CHAT_MESSAGES_QUERY_KEY],
			predicate: query => query.queryKey[1] !== chatRoomId,
		});

		setHydration({ ready: false, needsApi: false });
		setError(null);

		void (async () => {
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
		})();

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
		throwOnError: (error) => !isAbortError(error),
	});

	const isLoading =
		Boolean(chatRoomId) &&
		(!hydration.ready || (hydration.needsApi && query.isFetching));

	useEffect(() => {
		setLoadingMessages(isLoading);
	}, [isLoading, setLoadingMessages]);

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
		(!hydration.needsApi || query.isSuccess || (query.isError && isAbortError(query.error)));

	return {
		isLoading,
		isReady,
		isError: query.isError && !isAbortError(query.error),
	};
}
