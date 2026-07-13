"use client";

import { useEffect, useRef, useState } from "react";
import ChatBox from "@/components/chats/ChatBox";
import { chatApi } from "@/app-api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import { mergeChatRoomParticipants } from "@/utils/normalizeChatParticipants";
import type { useWebSocketChatSync } from "@/hooks/useWebSocketChatSync";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";

type BidRateChatEmbedProps = {
	chatRoomId: string;
	webSocketChatSync: ReturnType<typeof useWebSocketChatSync>;
};

/**
 * Embeds the BID chat (same ChatBox as LOAD/GROUP) inside an expanded bid card.
 */
export default function BidRateChatEmbed({
	chatRoomId,
	webSocketChatSync,
}: BidRateChatEmbedProps) {
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const leaveChatRoomRef = useRef(webSocketChatSync.leaveChatRoom);
	leaveChatRoomRef.current = webSocketChatSync.leaveChatRoom;

	useEffect(() => {
		let cancelled = false;

		async function openRoom() {
			setReady(false);
			setError(null);

			try {
				const store = useChatStore.getState();
				const fromList = store.chatRooms.find(room => room.id === chatRoomId);
				const roomFromApi = fromList ?? (await chatApi.getChatRoom(chatRoomId));
				const room = {
					...roomFromApi,
					participants: mergeChatRoomParticipants(
						roomFromApi.participants,
						fromList?.participants,
					),
				};

				if (cancelled) return;

				const latest = useChatStore.getState();
				if (!latest.chatRooms.some(r => r.id === room.id)) {
					latest.addChatRoom(room);
				}
				if (latest.currentChatRoom?.id !== room.id) {
					latest.setCurrentChatRoom(room);
				}
				setReady(true);
			} catch (err) {
				console.error("Failed to open bid chat:", err);
				if (!cancelled) {
					setError("Failed to load bid chat");
					setReady(false);
				}
			}
		}

		openRoom().catch(() => undefined);

		return () => {
			cancelled = true;
			const current = useChatStore.getState().currentChatRoom;
			if (current?.id === chatRoomId) {
				leaveChatRoomRef.current?.(chatRoomId);
				useChatStore.getState().setCurrentChatRoom(null);
			}
		};
	}, [chatRoomId]);

	if (error) {
		return (
			<p className="py-6 text-center text-sm text-red-500 dark:text-red-400">{error}</p>
		);
	}

	if (!ready) {
		return (
			<div className="flex justify-center py-10">
				<SpinnerOne />
			</div>
		);
	}

	return (
		<div className="h-[560px] w-full overflow-hidden rounded-xl [&_>div]:!w-full [&_>div]:!max-w-none [&_>div]:xl:!w-full">
			<ChatBox
				selectedChatRoomId={chatRoomId}
				webSocketChatSync={webSocketChatSync}
			/>
		</div>
	);
}
