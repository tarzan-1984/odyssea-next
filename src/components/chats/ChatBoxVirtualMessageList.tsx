"use client";

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { Message, ChatRoomParticipant } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";
import MessageItem from "./MessageItem";
import { estimateChatMessageHeight } from "@/utils/estimateChatMessageHeight";

const MESSAGE_GAP_PX = 24;
const VIRTUAL_OVERSCAN = 10;

export interface ChatBoxVirtualMessageListHandle {
	scrollToBottom: () => void;
}

interface ChatBoxVirtualMessageListProps {
	messages: Message[];
	currentUser: UserData | null;
	chatRoomType?: string;
	chatParticipants: ChatRoomParticipant[];
	scrollElement: HTMLDivElement | null;
	onDelete: (messageId: string) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
	onContentMeasured?: () => void;
}

interface VirtualMessageRowProps {
	virtualRow: VirtualItem;
	message: Message;
	measuredHeightsRef: React.MutableRefObject<Map<string, number>>;
	virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
	currentUser: UserData | null;
	chatRoomType?: string;
	chatParticipants: ChatRoomParticipant[];
	onDelete: (messageId: string) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
}

function VirtualMessageRow({
	virtualRow,
	message,
	measuredHeightsRef,
	virtualizer,
	currentUser,
	chatRoomType,
	chatParticipants,
	onDelete,
	onReply,
	onMarkUnread,
	onRetry,
}: VirtualMessageRowProps) {
	const measureRow = useCallback(
		(node: HTMLDivElement | null) => {
			if (!node) return;
			virtualizer.measureElement(node);
			const measured = node.getBoundingClientRect().height;
			if (measured > 0) {
				const prev = measuredHeightsRef.current.get(message.id);
				if (prev !== measured) {
					measuredHeightsRef.current.set(message.id, measured);
					if (prev != null && Math.abs(prev - measured) > 4) {
						virtualizer.measure();
					}
				}
			}
		},
		[message.id, measuredHeightsRef, virtualizer]
	);

	return (
		<div
			data-index={virtualRow.index}
			ref={measureRow}
			className="absolute left-0 top-0 w-full"
			style={{
				transform: `translateY(${virtualRow.start}px)`,
			}}
		>
			<MessageItem
				message={message}
				currentUser={currentUser}
				chatRoomType={chatRoomType}
				chatParticipants={chatParticipants}
				onDelete={onDelete}
				onReply={onReply}
				onMarkUnread={onMarkUnread}
				onRetry={
					message.pendingOutgoing?.status === "failed" && onRetry
						? () => onRetry(message)
						: undefined
				}
			/>
		</div>
	);
}

const ChatBoxVirtualMessageList = forwardRef<
	ChatBoxVirtualMessageListHandle,
	ChatBoxVirtualMessageListProps
>(function ChatBoxVirtualMessageList(
	{
		messages,
		currentUser,
		chatRoomType,
		chatParticipants,
		scrollElement,
		onDelete,
		onReply,
		onMarkUnread,
		onRetry,
		onContentMeasured,
	},
	ref
) {
	const measuredHeightsRef = useRef<Map<string, number>>(new Map());

	const getEstimateSize = useCallback(
		(index: number) => {
			const message = messages[index];
			if (!message) return 96;
			return (
				measuredHeightsRef.current.get(message.id) ??
				estimateChatMessageHeight(message)
			);
		},
		[messages]
	);

	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => scrollElement,
		estimateSize: getEstimateSize,
		gap: MESSAGE_GAP_PX,
		overscan: VIRTUAL_OVERSCAN,
		getItemKey: index => messages[index]?.id ?? index,
		measureElement: element => element.getBoundingClientRect().height,
	});

	const scrollToBottom = useCallback(() => {
		if (messages.length === 0) return;
		virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
	}, [messages.length, virtualizer]);

	useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

	useEffect(() => {
		measuredHeightsRef.current.clear();
	}, [messages[0]?.chatRoomId]);

	useEffect(() => {
		if (!scrollElement || messages.length === 0) return;
		virtualizer.measure();
		onContentMeasured?.();
	}, [scrollElement, messages.length, virtualizer.measure]);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div
			className="relative w-full"
			style={{ height: `${virtualizer.getTotalSize()}px` }}
		>
			{virtualItems.map(virtualRow => {
				const message = messages[virtualRow.index];
				if (!message) return null;

				return (
					<VirtualMessageRow
						key={virtualRow.key}
						virtualRow={virtualRow}
						message={message}
						measuredHeightsRef={measuredHeightsRef}
						virtualizer={virtualizer}
						currentUser={currentUser}
						chatRoomType={chatRoomType}
						chatParticipants={chatParticipants}
						onDelete={onDelete}
						onReply={onReply}
						onMarkUnread={onMarkUnread}
						onRetry={onRetry}
					/>
				);
			})}
		</div>
	);
});

export default ChatBoxVirtualMessageList;
