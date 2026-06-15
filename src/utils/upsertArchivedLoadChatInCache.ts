import { type InfiniteData, type QueryClient } from "@tanstack/react-query";
import { type ChatRoom } from "@/app-api/chatApi";
import { ARCHIVED_LOAD_CHATS_QUERY_KEY } from "@/components/chats/loadArchivedChatsQueryKey";

type ArchivedPage = {
	chatRooms: ChatRoom[];
	pagination: { page: number; limit: number; hasMore: boolean };
};

/** Ensures a deep-linked archived LOAD chat appears in the archive infinite-query cache. */
export function upsertArchivedLoadChatInCache(
	queryClient: QueryClient,
	room: ChatRoom
): void {
	queryClient.setQueryData<InfiniteData<ArchivedPage>>(
		ARCHIVED_LOAD_CHATS_QUERY_KEY,
		prev => {
			if (!prev?.pages?.length) {
				return {
					pageParams: [1],
					pages: [
						{
							chatRooms: [room],
							pagination: { page: 1, limit: 10, hasMore: true },
						},
					],
				};
			}

			const alreadyPresent = prev.pages.some(page =>
				page.chatRooms.some(r => r.id === room.id)
			);
			if (alreadyPresent) return prev;

			const pages = prev.pages.map((page, index) => {
				if (index !== 0) return page;
				return {
					...page,
					chatRooms: [room, ...page.chatRooms.filter(r => r.id !== room.id)],
				};
			});

			return { ...prev, pages };
		}
	);
}
