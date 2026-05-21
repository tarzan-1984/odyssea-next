"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChatRoom } from "@/app-api/chatApi";
import { chatApi } from "@/app-api/chatApi";
import ChatListItem from "./ChatListItem";
import { useCurrentUser } from "@/stores/userStore";
import { ChevronDownIcon, ChevronUpIcon } from "@/icons";
import { ARCHIVED_LOAD_CHATS_QUERY_KEY } from "./loadArchivedChatsQueryKey";
import { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";

const PAGE_SIZE = 10;


interface LoadChatsArchiveSectionProps {
	/** Only fetch when Shipments tab is active */
	tabActive: boolean;
	selectedChatId?: string;
	onChatSelect: (chatRoom: ChatRoom) => void;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
	loadChatRooms: (options?: { force?: boolean }) => Promise<void>;
}

function archivedChatTitle(chatRoom: ChatRoom): string {
	if (chatRoom.name?.trim()) {
		return chatRoom.name.trim();
	}
	if (chatRoom.loadId?.trim()) {
		return `#${chatRoom.loadId.trim()}`;
	}
	return "Archived load chat";
}

export default function LoadChatsArchiveSection({
	tabActive,
	selectedChatId,
	onChatSelect,
	webSocketChatSync,
	loadChatRooms,
}: LoadChatsArchiveSectionProps) {
	const currentUser = useCurrentUser();
	const [expanded, setExpanded] = useState(false);
	const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

	const scrollRootRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const {
		data,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		isLoading,
		isError,
	} = useInfiniteQuery({
		queryKey: ARCHIVED_LOAD_CHATS_QUERY_KEY,
		queryFn: ({ pageParam }) =>
			chatApi.getArchivedLoadChatRooms(Number(pageParam) || 1, PAGE_SIZE),
		enabled: tabActive && expanded,
		initialPageParam: 1,
		getNextPageParam: last =>
			last.pagination?.hasMore ? last.pagination.page + 1 : undefined,
		staleTime: 10 * 60 * 1000,
	});

	useEffect(() => {
		const root = scrollRootRef.current;
		const sentinel = sentinelRef.current;
		if (!tabActive || !expanded || !root || !sentinel) {
			return;
		}

		const observer = new IntersectionObserver(entries => {
			const hit = entries.some(e => e.isIntersecting);
			if (hit && hasNextPage && !isFetchingNextPage) {
				fetchNextPage().catch(() => {});
			}
		}, { root, rootMargin: "100px", threshold: 0 });

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [
		tabActive,
		expanded,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		data?.pages?.length,
	]);

	const archivedRooms = React.useMemo(
		() =>
			Array.isArray(data?.pages)
				? data!.pages.flatMap(p => (Array.isArray(p.chatRooms) ? p.chatRooms : []))
				: [],
		[data]
	);

	return (
		<div className="mt-auto flex min-h-0 shrink-0 flex-col pt-2">
			<div className="overflow-hidden rounded-xl border border-gray-200 shadow-theme-xs dark:border-gray-700 dark:shadow-none">
				<button
					type="button"
					onClick={() => setExpanded(e => !e)}
					className="flex w-full items-center gap-2 bg-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-200/90 dark:bg-white/[0.06] dark:hover:bg-white/[0.09]"
					aria-expanded={expanded}
				>
					<span className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
						Archive
					</span>
					<span className="ml-auto shrink-0 text-gray-500 dark:text-gray-400" aria-hidden="true">
						{expanded ? (
							<ChevronUpIcon className="h-4 w-4" />
						) : (
							<ChevronDownIcon className="h-4 w-4" />
						)}
					</span>
				</button>

				{expanded && (
					<div className="border-t border-gray-200 bg-gray-50/90 dark:border-white/10 dark:bg-white/[0.03]">
				<div
					ref={scrollRootRef}
					className="max-h-[min(20rem,42vh)] min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
				>
					{isLoading && archivedRooms.length === 0 ? (
						<div className="px-3 py-4 text-center text-sm text-gray-500">
							Loading archived…
						</div>
					) : isError ? (
						<div className="px-3 py-4 text-center text-sm text-red-500">
							Failed to load archive
						</div>
					) : archivedRooms.length === 0 ? (
						<div className="px-3 py-4 text-center text-sm text-gray-500">
							No archived shipments yet
						</div>
					) : (
						<ul className="divide-y divide-gray-200 py-1 dark:divide-white/10">
							{archivedRooms.map(chatRoom => {
								const isSelected = selectedChatId === chatRoom.id;
								const title = archivedChatTitle(chatRoom);
								const displayRoom =
									chatRoom.name === title ? chatRoom : { ...chatRoom, name: title };

								const status =
									displayRoom?.type === "DIRECT" &&
									displayRoom.participants.length === 2
										? (() => {
												const otherParticipant = displayRoom.participants.find(
													p => p.user.id !== currentUser?.id
												);
												if (
													otherParticipant &&
													webSocketChatSync.isUserOnline
												) {
													return webSocketChatSync.isUserOnline(otherParticipant.user.id)
														? "online"
														: "offline";
												}
												return "offline";
										  })()
										: "offline";

								return (
									<ChatListItem
										key={`arch-${chatRoom.id}`}
										chatRoom={displayRoom}
										isSelected={isSelected}
										status={status}
										onChatSelect={onChatSelect}
										isUserOnline={webSocketChatSync.isUserOnline}
										onChatRoomUpdate={() => loadChatRooms({ force: true })}
										isMenuOpen={openMenuChatId === chatRoom.id}
										onMenuToggle={open => setOpenMenuChatId(open ? chatRoom.id : null)}
									/>
								);
							})}
						</ul>
					)}
					<div ref={sentinelRef} aria-hidden className="h-2 w-full shrink-0" />
					{isFetchingNextPage && (
						<div className="border-t border-gray-200 px-3 py-2 text-center text-xs text-gray-500 dark:border-white/10">
							Loading more…
						</div>
					)}
				</div>
					</div>
				)}
			</div>
		</div>
	);
}
