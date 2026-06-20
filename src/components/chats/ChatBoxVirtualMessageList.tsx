"use client";

import React, {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
} from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { Message, ChatRoomParticipant } from "@/app-api/chatApi";
import { UserData } from "@/app-api/api-types";
import MessageItem from "./MessageItem";
import { estimateChatMessageHeight } from "@/utils/estimateChatMessageHeight";

const MESSAGE_GAP_PX = 24;
const VIRTUAL_OVERSCAN = 8;
const SCROLL_IDLE_MEASURE_DELAY_MS = 1200;

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
	onEdit: (message: Message) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
	onContentMeasured?: () => void;
	isUserScrolledUp?: boolean;
}

interface VirtualMessageRowProps {
	virtualRow: VirtualItem;
	message: Message;
	measuredHeightsRef: React.MutableRefObject<Map<string, number>>;
	isScrollingRef: React.MutableRefObject<boolean>;
	pendingMeasureRef: React.MutableRefObject<boolean>;
	virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
	currentUser: UserData | null;
	chatRoomType?: string;
	chatParticipants: ChatRoomParticipant[];
	onDelete: (messageId: string) => void;
	onEdit: (message: Message) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
}

function VirtualMessageRow({
	virtualRow,
	message,
	measuredHeightsRef,
	isScrollingRef,
	pendingMeasureRef,
	virtualizer,
	currentUser,
	chatRoomType,
	chatParticipants,
	onDelete,
	onEdit,
	onReply,
	onMarkUnread,
	onRetry,
}: VirtualMessageRowProps) {
	const rowRef = useRef<HTMLDivElement>(null);
	const measureRafRef = useRef<number | null>(null);

	useLayoutEffect(() => {
		const node = rowRef.current;
		if (!node) return;

		if (isScrollingRef.current) {
			pendingMeasureRef.current = true;
		} else {
			virtualizer.measureElement(node);
		}

		const syncMeasuredHeight = () => {
			const measured = node.getBoundingClientRect().height;
			if (measured <= 0) return;

			const prev = measuredHeightsRef.current.get(message.id);
			measuredHeightsRef.current.set(message.id, measured);
			if (prev != null && Math.abs(prev - measured) <= 2) {
				return;
			}

			if (isScrollingRef.current) {
				pendingMeasureRef.current = true;
				return;
			}

			if (measureRafRef.current != null) {
				cancelAnimationFrame(measureRafRef.current);
			}
			measureRafRef.current = requestAnimationFrame(() => {
				measureRafRef.current = null;
				virtualizer.measureElement(node);
			});
		};

		syncMeasuredHeight();

		const observer = new ResizeObserver(() => {
			syncMeasuredHeight();
		});
		observer.observe(node);

		return () => {
			observer.disconnect();
			if (measureRafRef.current != null) {
				cancelAnimationFrame(measureRafRef.current);
			}
		};
	}, [isScrollingRef, measuredHeightsRef, message.id, pendingMeasureRef, virtualizer]);

	return (
		<div
			ref={rowRef}
			data-index={virtualRow.index}
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
				onEdit={onEdit}
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
		onEdit,
		onReply,
		onMarkUnread,
		onRetry,
		onContentMeasured,
		isUserScrolledUp = false,
	},
	ref
) {
	const measuredHeightsRef = useRef<Map<string, number>>(new Map());
	const isScrollingRef = useRef(false);
	const pendingMeasureRef = useRef(false);
	const scrollIdleTimerRef = useRef<number | null>(null);
	const virtualizerRef = useRef<ReturnType<
		typeof useVirtualizer<HTMLDivElement, Element>
	> | null>(null);
	const onContentMeasuredRef = useRef(onContentMeasured);
	const firstMessageChatRoomId = messages[0]?.chatRoomId;

	const getEstimateSize = useCallback(
		(index: number) => {
			const message = messages[index];
			if (!message) return 96;
			return (
				measuredHeightsRef.current.get(message.id) ??
				estimateChatMessageHeight(message, {
					currentUserId: currentUser?.id,
					chatRoomType,
				})
			);
		},
		[messages, currentUser?.id, chatRoomType]
	);

	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => scrollElement,
		estimateSize: getEstimateSize,
		gap: MESSAGE_GAP_PX,
		overscan: VIRTUAL_OVERSCAN,
		isScrollingResetDelay: SCROLL_IDLE_MEASURE_DELAY_MS,
		getItemKey: index => messages[index]?.id ?? index,
	});
	virtualizerRef.current = virtualizer;

	useEffect(() => {
		onContentMeasuredRef.current = onContentMeasured;
	}, [onContentMeasured]);

	useEffect(() => {
		if (!scrollElement) return;

		const markScrolling = () => {
			isScrollingRef.current = true;
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
			scrollIdleTimerRef.current = window.setTimeout(() => {
				isScrollingRef.current = false;
				scrollIdleTimerRef.current = null;
				if (pendingMeasureRef.current) {
					pendingMeasureRef.current = false;
					virtualizerRef.current?.measure();
					onContentMeasuredRef.current?.();
				}
			}, SCROLL_IDLE_MEASURE_DELAY_MS);
		};

		scrollElement.addEventListener("wheel", markScrolling, { passive: true, capture: true });
		scrollElement.addEventListener("touchmove", markScrolling, {
			passive: true,
			capture: true,
		});
		scrollElement.addEventListener("scroll", markScrolling, { passive: true });
		return () => {
			scrollElement.removeEventListener("wheel", markScrolling, { capture: true });
			scrollElement.removeEventListener("touchmove", markScrolling, { capture: true });
			scrollElement.removeEventListener("scroll", markScrolling);
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
				scrollIdleTimerRef.current = null;
			}
			isScrollingRef.current = false;
			pendingMeasureRef.current = false;
		};
	}, [scrollElement]);

	useLayoutEffect(() => {
		virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) => {
			if (isScrollingRef.current || !isUserScrolledUp) {
				return false;
			}
			const offset = instance.scrollOffset ?? 0;
			return item.start < offset;
		};
	}, [isUserScrolledUp, virtualizer]);

	const scrollToBottom = useCallback(() => {
		if (messages.length === 0) return;
		virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
	}, [messages.length, virtualizer]);

	useImperativeHandle(ref, () => ({ scrollToBottom }), [scrollToBottom]);

	useEffect(() => {
		measuredHeightsRef.current.clear();
	}, [firstMessageChatRoomId]);

	useEffect(() => {
		if (!scrollElement || messages.length === 0) return;
		if (isScrollingRef.current) {
			pendingMeasureRef.current = true;
			return;
		}
		virtualizerRef.current?.measure();
		onContentMeasuredRef.current?.();
	}, [scrollElement, messages.length, firstMessageChatRoomId]);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div
			className="relative w-full"
			style={{ height: `${virtualizer.getTotalSize()}px`, overflowAnchor: "none" }}
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
						isScrollingRef={isScrollingRef}
						pendingMeasureRef={pendingMeasureRef}
						virtualizer={virtualizer}
						currentUser={currentUser}
						chatRoomType={chatRoomType}
						chatParticipants={chatParticipants}
						onDelete={onDelete}
						onEdit={onEdit}
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
