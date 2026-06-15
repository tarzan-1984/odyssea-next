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
import { chatRoomMatchesSearchQuery } from "@/utils/chatSearch";

const PAGE_SIZE = 10;

interface LoadChatsArchiveSectionProps {
	/** Only fetch when Shipments tab is active */
	tabActive: boolean;
	selectedChatId?: string;
	onChatSelect: (chatRoom: ChatRoom) => void;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
	loadChatRooms: (options?: { force?: boolean }) => Promise<void>;
	/** Expand archive list (e.g. deep link to archived LOAD chat). */
	expandArchive?: boolean;
	/** Deep-linked archived LOAD chat — always shown at top of the archive list. */
	pinnedArchivedRoom?: ChatRoom | null;
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
	expandArchive = false,
	pinnedArchivedRoom = null,
}: LoadChatsArchiveSectionProps) {
	const currentUser = useCurrentUser();
	const [expanded, setExpanded] = useState(false);
	const [archiveSearchQuery, setArchiveSearchQuery] = useState("");
	const [debouncedArchiveSearch, setDebouncedArchiveSearch] = useState("");
	const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);

	useEffect(() => {
		if (expandArchive) {
			setExpanded(true);
		}
	}, [expandArchive]);

	const scrollRootRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);

	const clearArchiveSearch = () => {
		setArchiveSearchQuery("");
		setDebouncedArchiveSearch("");
	};

	/** Mirrors `ChatList.getChatDisplayName` + LOAD fallback like GROUP (archived shipments are LOAD). */
	const getArchiveChatDisplayName = React.useCallback(
		(chatRoom: ChatRoom): string => {
			if (chatRoom.type === "DIRECT" && chatRoom.participants.length === 2) {
				const otherParticipant = chatRoom.participants.find(
					p => p.user.id !== currentUser?.id
				);
				if (otherParticipant) {
					return `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}`;
				}
			}

			if (chatRoom.name) {
				return chatRoom.name;
			}

			if (chatRoom.type === "GROUP" || chatRoom.type === "LOAD") {
				const participantNames = chatRoom.participants
					.slice(0, 2)
					.map(p => p.user.firstName)
					.join(", ");
				return participantNames + (chatRoom.participants.length > 2 ? "..." : "");
			}

			return "Unknown Chat";
		},
		[currentUser?.id]
	);

	const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading, isError } =
		useInfiniteQuery({
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
		const timer = window.setTimeout(() => {
			setDebouncedArchiveSearch(archiveSearchQuery);
		}, 300);

		return () => window.clearTimeout(timer);
	}, [archiveSearchQuery]);

	const archivedRooms = React.useMemo(
		() =>
			Array.isArray(data?.pages)
				? data!.pages.flatMap(p => (Array.isArray(p.chatRooms) ? p.chatRooms : []))
				: [],
		[data]
	);

	const filteredArchivedRooms = React.useMemo(() => {
		const q = debouncedArchiveSearch.trim().toLowerCase();
		if (!q) return archivedRooms;
		return archivedRooms.filter(room =>
			chatRoomMatchesSearchQuery(room, q, getArchiveChatDisplayName, {
				includeParticipantPhones: true,
			})
		);
	}, [archivedRooms, debouncedArchiveSearch, getArchiveChatDisplayName]);

	const visibleArchivedRooms = React.useMemo(() => {
		if (!pinnedArchivedRoom) return filteredArchivedRooms;
		if (filteredArchivedRooms.some(r => r.id === pinnedArchivedRoom.id)) {
			return filteredArchivedRooms;
		}
		return [pinnedArchivedRoom, ...filteredArchivedRooms];
	}, [filteredArchivedRooms, pinnedArchivedRoom]);

	const isArchiveSearchActive = debouncedArchiveSearch.trim().length > 0;

	useEffect(() => {
		const root = scrollRootRef.current;
		const sentinel = sentinelRef.current;
		if (!tabActive || !expanded || !root || !sentinel || isArchiveSearchActive) {
			return;
		}

		const observer = new IntersectionObserver(
			entries => {
				const hit = entries.some(e => e.isIntersecting);
				if (hit && hasNextPage && !isFetchingNextPage) {
					fetchNextPage().catch(() => {});
				}
			},
			{ root, rootMargin: "100px", threshold: 0 }
		);

		observer.observe(sentinel);

		return () => observer.disconnect();
	}, [
		tabActive,
		expanded,
		isArchiveSearchActive,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
		data?.pages?.length,
	]);

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
					<span
						className="ml-auto shrink-0 text-gray-500 dark:text-gray-400"
						aria-hidden="true"
					>
						{expanded ? (
							<ChevronUpIcon className="h-4 w-4" />
						) : (
							<ChevronDownIcon className="h-4 w-4" />
						)}
					</span>
				</button>

				{expanded && (
					<div className="flex max-h-[min(26rem,52vh)] min-h-0 flex-col border-t border-gray-200 bg-gray-50/90 dark:border-white/10 dark:bg-white/[0.03]">
						<div className="shrink-0 border-b border-gray-200 bg-gray-50/90 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
							<div className="relative">
								<button
									type="button"
									className="absolute -translate-y-1/2 left-3 top-1/2"
									aria-hidden
								>
									<svg
										className="fill-gray-500 dark:fill-gray-400"
										width="16"
										height="16"
										viewBox="0 0 20 20"
										fill="none"
										xmlns="http://www.w3.org/2000/svg"
									>
										<path
											fillRule="evenodd"
											clipRule="evenodd"
											d="M3.04199 9.37381C3.04199 5.87712 5.87735 3.04218 9.37533 3.04218C12.8733 3.04218 15.7087 5.87712 15.7087 9.37381C15.7087 12.8705 12.8733 15.7055 9.37533 15.7055C5.87735 15.7055 3.04199 12.8705 3.04199 9.37381ZM9.37533 1.54218C5.04926 1.54218 1.54199 5.04835 1.54199 9.37381C1.54199 13.6993 5.04926 17.2055 9.37533 17.2055C11.2676 17.2055 13.0032 16.5346 14.3572 15.4178L17.1773 18.2381C17.4702 18.531 17.945 18.5311 18.2379 18.2382C18.5308 17.9453 18.5309 17.4704 18.238 17.1775L15.4182 14.3575C16.5367 13.0035 17.2087 11.2671 17.2087 9.37381C17.2087 5.04835 13.7014 1.54218 9.37533 1.54218Z"
											fill=""
										/>
									</svg>
								</button>
								<input
									type="search"
									autoComplete="off"
									placeholder="Search chats..."
									value={archiveSearchQuery}
									onChange={e => setArchiveSearchQuery(e.target.value)}
									className="dark:bg-dark-900 h-9 w-full rounded-lg border border-gray-300 bg-transparent pl-9 pr-9 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
									aria-label="Search archived chats"
								/>
								{archiveSearchQuery !== "" ? (
									<button
										type="button"
										onClick={clearArchiveSearch}
										className="absolute -translate-y-1/2 right-3 top-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
										aria-label="Clear archived chat search"
									>
										<svg width="16" height="16" viewBox="0 0 20 20" fill="none">
											<path
												fillRule="evenodd"
												clipRule="evenodd"
												d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
												fill="currentColor"
											/>
										</svg>
									</button>
								) : null}
							</div>
						</div>
						<div
							ref={scrollRootRef}
							className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
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
							) : visibleArchivedRooms.length === 0 ? (
								<div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
									{debouncedArchiveSearch.trim() ? (
										<>No chats found</>
									) : (
										<>No archived shipments yet</>
									)}
								</div>
							) : (
								<ul className="divide-y divide-gray-200 py-1 dark:divide-white/10">
									{visibleArchivedRooms.map(chatRoom => {
										const isSelected = selectedChatId === chatRoom.id;
										const title = archivedChatTitle(chatRoom);
										const displayRoom =
											chatRoom.name === title
												? chatRoom
												: { ...chatRoom, name: title };

										const status =
											displayRoom?.type === "DIRECT" &&
											displayRoom.participants.length === 2
												? (() => {
														const otherParticipant =
															displayRoom.participants.find(
																p => p.user.id !== currentUser?.id
															);
														if (
															otherParticipant &&
															webSocketChatSync.isUserOnline
														) {
															return webSocketChatSync.isUserOnline(
																otherParticipant.user.id
															)
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
												onChatRoomUpdate={() =>
													loadChatRooms({ force: true })
												}
												isMenuOpen={openMenuChatId === chatRoom.id}
												onMenuToggle={open =>
													setOpenMenuChatId(open ? chatRoom.id : null)
												}
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
