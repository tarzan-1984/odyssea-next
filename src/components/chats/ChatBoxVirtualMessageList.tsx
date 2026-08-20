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
const SCROLL_IDLE_MEASURE_DELAY_MS = 150;

function readRowHeight(element: Element): number {
	return (element as HTMLElement).offsetHeight;
}

export interface ChatBoxVirtualMessageListHandle {
	scrollToBottom: () => void;
	measure: () => void;
	getScrollAnchor: () => ChatBoxVirtualScrollAnchor | null;
	restoreScrollAnchor: (anchor: ChatBoxVirtualScrollAnchor) => boolean;
}

export interface ChatBoxVirtualScrollAnchor {
	messageId: string;
	offset: number;
}

interface ChatBoxVirtualMessageListProps {
	messages: Message[];
	currentUser: UserData | null;
	chatRoomType?: string;
	chatParticipants: ChatRoomParticipant[];
	chatUserNameLookup?: Map<string, string>;
	latestBidPlusOneMessageIdBySender?: Map<string, string>;
	scrollElement: HTMLDivElement | null;
	onDelete: (messageId: string) => void;
	onEdit: (message: Message) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
	onDiscardFailed?: (message: Message) => void;
	onContentMeasured?: () => void;
	isUserScrolledUp?: boolean;
	suppressScrollAdjustment?: boolean;
	onAcceptShipmentTerms?: () => void;
	isAcceptingShipmentTerms?: boolean;
}

interface VirtualMessageRowProps {
	virtualRow: VirtualItem;
	message: Message;
	measuredHeightsRef: React.MutableRefObject<Map<string, number>>;
	isScrollingRef: React.MutableRefObject<boolean>;
	isSelectingRef: React.MutableRefObject<boolean>;
	pendingMeasureRef: React.MutableRefObject<boolean>;
	virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
	currentUser: UserData | null;
	chatRoomType?: string;
	chatParticipants: ChatRoomParticipant[];
	chatUserNameLookup?: Map<string, string>;
	latestBidPlusOneMessageIdBySender?: Map<string, string>;
	onDelete: (messageId: string) => void;
	onEdit: (message: Message) => void;
	onReply: (message: Message) => void;
	onMarkUnread: (messageId: string) => void;
	onRetry?: (message: Message) => void;
	onDiscardFailed?: (message: Message) => void;
	onAcceptShipmentTerms?: () => void;
	isAcceptingShipmentTerms?: boolean;
}

function VirtualMessageRow({
	virtualRow,
	message,
	measuredHeightsRef,
	isScrollingRef,
	isSelectingRef,
	pendingMeasureRef,
	virtualizer,
	currentUser,
	chatRoomType,
	chatParticipants,
	chatUserNameLookup,
	latestBidPlusOneMessageIdBySender,
	onDelete,
	onEdit,
	onReply,
	onMarkUnread,
	onRetry,
	onDiscardFailed,
	onAcceptShipmentTerms,
	isAcceptingShipmentTerms = false,
}: VirtualMessageRowProps) {
	const rowRef = useRef<HTMLDivElement>(null);
	const measureRafRef = useRef<number | null>(null);

	const assignRowRef = useCallback(
		(node: HTMLDivElement | null) => {
			rowRef.current = node;
			if (node) {
				virtualizer.measureElement(node);
			}
		},
		[virtualizer]
	);

	useLayoutEffect(() => {
		const node = rowRef.current;
		if (!node) return;

		// Always register/measure on mount so rows are not stuck on a short estimate.
		virtualizer.measureElement(node);

		const shouldDeferResize = () => isScrollingRef.current || isSelectingRef.current;

		const syncMeasuredHeight = () => {
			const measured = node.offsetHeight;
			if (measured <= 0) return;

			const prev = measuredHeightsRef.current.get(message.id);
			measuredHeightsRef.current.set(message.id, measured);
			if (prev != null && Math.abs(prev - measured) <= 2) {
				return;
			}

			if (shouldDeferResize()) {
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
	}, [
		isScrollingRef,
		isSelectingRef,
		measuredHeightsRef,
		message.content,
		message.id,
		pendingMeasureRef,
		virtualRow.index,
		virtualizer,
	]);

	return (
		<div
			ref={assignRowRef}
			data-index={virtualRow.index}
			className="pointer-events-none absolute left-0 w-full"
			style={{
				top: virtualRow.start,
			}}
		>
			<MessageItem
				message={message}
				currentUser={currentUser}
				chatRoomType={chatRoomType}
				chatParticipants={chatParticipants}
				chatUserNameLookup={chatUserNameLookup}
				latestBidPlusOneMessageIdBySender={latestBidPlusOneMessageIdBySender}
				onDelete={onDelete}
				onEdit={onEdit}
				onReply={onReply}
				onMarkUnread={onMarkUnread}
				onRetry={
					message.pendingOutgoing?.status === "failed" && onRetry
						? () => onRetry(message)
						: undefined
				}
				onDiscardFailed={
					message.pendingOutgoing?.status === "failed" && onDiscardFailed
						? () => onDiscardFailed(message)
						: undefined
				}
				onAcceptShipmentTerms={
					message.isSystemMessage ? onAcceptShipmentTerms : undefined
				}
				isAcceptingShipmentTerms={isAcceptingShipmentTerms}
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
		chatUserNameLookup,
		latestBidPlusOneMessageIdBySender,
		scrollElement,
		onDelete,
		onEdit,
		onReply,
		onMarkUnread,
		onRetry,
		onDiscardFailed,
		onContentMeasured,
		isUserScrolledUp = false,
		suppressScrollAdjustment = false,
		onAcceptShipmentTerms,
		isAcceptingShipmentTerms = false,
	},
	ref
) {
	const measuredHeightsRef = useRef<Map<string, number>>(new Map());
	const isScrollingRef = useRef(false);
	const isSelectingRef = useRef(false);
	const pendingMeasureRef = useRef(false);
	const scrollIdleTimerRef = useRef<number | null>(null);
	const virtualizerRef = useRef<ReturnType<
		typeof useVirtualizer<HTMLDivElement, Element>
	> | null>(null);
	const listRootRef = useRef<HTMLDivElement | null>(null);
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
		measureElement: readRowHeight,
		gap: MESSAGE_GAP_PX,
		overscan: VIRTUAL_OVERSCAN,
		getItemKey: index => messages[index]?.id ?? index,
	});
	virtualizerRef.current = virtualizer;

	useEffect(() => {
		onContentMeasuredRef.current = onContentMeasured;
	}, [onContentMeasured]);

	useLayoutEffect(() => {
		virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) => {
			if (
				suppressScrollAdjustment ||
				isScrollingRef.current ||
				isSelectingRef.current ||
				!isUserScrolledUp
			) {
				return false;
			}
			const offset = instance.scrollOffset ?? 0;
			return item.start < offset;
		};
	}, [isUserScrolledUp, suppressScrollAdjustment, virtualizer]);

	const remasureVisibleRows = useCallback(() => {
		const instance = virtualizerRef.current;
		const root = listRootRef.current;
		if (!instance) return;

		if (!root) {
			instance.measure();
			return;
		}

		root.querySelectorAll<HTMLElement>("[data-index]").forEach(node => {
			if (node.offsetHeight > 0) {
				instance.measureElement(node);
			}
		});
	}, []);

	const scrollToBottom = useCallback(() => {
		if (messages.length === 0) return;
		virtualizer.scrollToIndex(messages.length - 1, { align: "end" });
	}, [messages.length, virtualizer]);

	const measure = useCallback(() => {
		remeasureVisibleRows();
	}, [remeasureVisibleRows]);

	const getScrollAnchor = useCallback((): ChatBoxVirtualScrollAnchor | null => {
		if (!scrollElement) return null;

		const offset = scrollElement.scrollTop;
		const virtualItems = virtualizer.getVirtualItems();
		const item =
			virtualItems.find(virtualItem => virtualItem.end > offset + 1) ?? virtualItems[0];
		if (!item) return null;

		const message = messages[item.index];
		if (!message) return null;

		return {
			messageId: message.id,
			offset: Math.max(0, offset - item.start),
		};
	}, [messages, scrollElement, virtualizer]);

	const restoreScrollAnchor = useCallback(
		(anchor: ChatBoxVirtualScrollAnchor): boolean => {
			const index = messages.findIndex(message => message.id === anchor.messageId);
			if (index === -1) return false;

			const item = virtualizer.getVirtualItems().find(virtualItem => virtualItem.index === index);
			if (!item) {
				virtualizer.scrollToIndex(index, { align: "start" });
				requestAnimationFrame(() => {
					if (scrollElement && anchor.offset > 0) {
						scrollElement.scrollTop += anchor.offset;
					}
				});
				return true;
			}

			virtualizer.scrollToOffset(Math.max(0, item.start + anchor.offset));
			return true;
		},
		[messages, scrollElement, virtualizer]
	);

	useImperativeHandle(
		ref,
		() => ({ scrollToBottom, measure, getScrollAnchor, restoreScrollAnchor }),
		[getScrollAnchor, measure, restoreScrollAnchor, scrollToBottom]
	);

	useEffect(() => {
		if (!scrollElement) return;

		const flushPendingMeasure = () => {
			const hadPending = pendingMeasureRef.current;
			pendingMeasureRef.current = false;
			const anchor = hadPending ? getScrollAnchor() : null;
			remeasureVisibleRows();
			if (anchor) {
				requestAnimationFrame(() => {
					remeasureVisibleRows();
					restoreScrollAnchor(anchor);
				});
			}
			if (hadPending) {
				onContentMeasuredRef.current?.();
			}
		};

		const markScrolling = () => {
			isScrollingRef.current = true;
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
			}
			scrollIdleTimerRef.current = window.setTimeout(() => {
				isScrollingRef.current = false;
				scrollIdleTimerRef.current = null;
				if (!isSelectingRef.current) {
					flushPendingMeasure();
				}
			}, SCROLL_IDLE_MEASURE_DELAY_MS);
		};

		const onSelectStart = (event: Event) => {
			const target = event.target;
			if (!(target instanceof Node) || !scrollElement.contains(target)) return;
			isSelectingRef.current = true;
		};

		const onSelectEnd = () => {
			if (!isSelectingRef.current) return;
			isSelectingRef.current = false;
			if (!isScrollingRef.current) {
				flushPendingMeasure();
			}
		};

		scrollElement.addEventListener("wheel", markScrolling, { passive: true, capture: true });
		scrollElement.addEventListener("touchmove", markScrolling, {
			passive: true,
			capture: true,
		});
		scrollElement.addEventListener("scroll", markScrolling, { passive: true });
		document.addEventListener("selectstart", onSelectStart);
		document.addEventListener("mouseup", onSelectEnd);
		document.addEventListener("touchend", onSelectEnd);
		return () => {
			scrollElement.removeEventListener("wheel", markScrolling, { capture: true });
			scrollElement.removeEventListener("touchmove", markScrolling, { capture: true });
			scrollElement.removeEventListener("scroll", markScrolling);
			document.removeEventListener("selectstart", onSelectStart);
			document.removeEventListener("mouseup", onSelectEnd);
			document.removeEventListener("touchend", onSelectEnd);
			if (scrollIdleTimerRef.current != null) {
				window.clearTimeout(scrollIdleTimerRef.current);
				scrollIdleTimerRef.current = null;
			}
			isScrollingRef.current = false;
			isSelectingRef.current = false;
			pendingMeasureRef.current = false;
		};
	}, [getScrollAnchor, remasureVisibleRows, restoreScrollAnchor, scrollElement]);

	useEffect(() => {
		measuredHeightsRef.current.clear();
	}, [firstMessageChatRoomId]);

	useEffect(() => {
		if (!scrollElement || messages.length === 0) return;
		if (isScrollingRef.current || isSelectingRef.current) {
			pendingMeasureRef.current = true;
			return;
		}
		remeasureVisibleRows();
		onContentMeasuredRef.current?.();
	}, [firstMessageChatRoomId, messages.length, remasureVisibleRows, scrollElement]);

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div
			ref={listRootRef}
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
						isSelectingRef={isSelectingRef}
						pendingMeasureRef={pendingMeasureRef}
						virtualizer={virtualizer}
						currentUser={currentUser}
						chatRoomType={chatRoomType}
						chatParticipants={chatParticipants}
						chatUserNameLookup={chatUserNameLookup}
						latestBidPlusOneMessageIdBySender={latestBidPlusOneMessageIdBySender}
						onDelete={onDelete}
						onEdit={onEdit}
						onReply={onReply}
						onMarkUnread={onMarkUnread}
						onRetry={onRetry}
						onDiscardFailed={onDiscardFailed}
						onAcceptShipmentTerms={onAcceptShipmentTerms}
						isAcceptingShipmentTerms={isAcceptingShipmentTerms}
					/>
				);
			})}
		</div>
	);
});

export default ChatBoxVirtualMessageList;
