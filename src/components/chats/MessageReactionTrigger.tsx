"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { chatApi, Message, MessageReactionGroup } from "@/app-api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import EmojiPicker from "@/components/ui/EmojiPicker";
import { QUICK_REACTIONS } from "./messageReactionConstants";

const PICKER_WIDTH = 320;
const POPOVER_ESTIMATED_HEIGHT = 420;
const VIEWPORT_PADDING = 8;

interface MessageReactionTriggerProps {
	message: Message;
	currentUserId?: string | null;
}

function computePopoverPosition(anchor: DOMRect): { top: number; left: number } {
	let left = anchor.left;
	if (left + PICKER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
		left = window.innerWidth - PICKER_WIDTH - VIEWPORT_PADDING;
	}
	left = Math.max(VIEWPORT_PADDING, left);

	let top = anchor.top - POPOVER_ESTIMATED_HEIGHT - VIEWPORT_PADDING;
	if (top < VIEWPORT_PADDING) {
		top = anchor.bottom + VIEWPORT_PADDING;
	}

	return { top, left };
}

/** Inside `group/bubble relative` — bottom-right corner of the bubble. */
export default function MessageReactionTrigger({
	message,
	currentUserId,
}: MessageReactionTriggerProps) {
	const updateMessage = useChatStore(s => s.updateMessage);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(
		null,
	);
	const pickerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);

	const reactions = message.reactions ?? [];

	useEffect(() => {
		setMounted(true);
	}, []);

	const updatePopoverPosition = useCallback(() => {
		if (!triggerRef.current) return;
		setPopoverPos(computePopoverPosition(triggerRef.current.getBoundingClientRect()));
	}, []);

	useEffect(() => {
		if (!pickerOpen) {
			setPopoverPos(null);
			return;
		}
		updatePopoverPosition();
		window.addEventListener("resize", updatePopoverPosition);
		window.addEventListener("scroll", updatePopoverPosition, true);
		return () => {
			window.removeEventListener("resize", updatePopoverPosition);
			window.removeEventListener("scroll", updatePopoverPosition, true);
		};
	}, [pickerOpen, updatePopoverPosition]);

	const applyReactions = useCallback(
		(next: MessageReactionGroup[]) => {
			updateMessage(message.id, { reactions: next });
		},
		[message.id, updateMessage],
	);

	const handleEmojiSelect = useCallback(
		async (emoji: string) => {
			if (busy || !currentUserId) return;
			setPickerOpen(false);
			setBusy(true);
			try {
				const result = await chatApi.setMessageReaction(message.id, emoji);
				applyReactions(result.reactions);
			} catch (error) {
				console.error("Failed to set reaction:", error);
			} finally {
				setBusy(false);
			}
		},
		[applyReactions, busy, currentUserId, message.id],
	);

	const handleQuickReaction = useCallback(
		async (emoji: string) => {
			const existing = reactions.find(r => r.emoji === emoji);
			if (existing?.hasCurrentUser) {
				if (busy || !currentUserId) return;
				setBusy(true);
				try {
					const result = await chatApi.removeMessageReaction(message.id);
					applyReactions(result.reactions);
				} catch (error) {
					console.error("Failed to remove reaction:", error);
				} finally {
					setBusy(false);
				}
			} else {
				await handleEmojiSelect(emoji);
			}
			setPickerOpen(false);
		},
		[applyReactions, busy, currentUserId, handleEmojiSelect, message.id, reactions],
	);

	useEffect(() => {
		if (!pickerOpen) return;
		const onDocClick = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				pickerRef.current?.contains(target) ||
				triggerRef.current?.contains(target)
			) {
				return;
			}
			setPickerOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [pickerOpen]);

	const visible = pickerOpen
		? "opacity-100 pointer-events-auto"
		: "opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto";

	const popover =
		pickerOpen && popoverPos && mounted
			? createPortal(
					<div
						ref={pickerRef}
						className="z-[10050] flex flex-col gap-1"
						style={{
							position: "fixed",
							top: popoverPos.top,
							left: popoverPos.left,
							width: PICKER_WIDTH,
						}}
					>
						<div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-full border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
							{QUICK_REACTIONS.map(emoji => (
								<button
									key={emoji}
									type="button"
									className="rounded-full px-1.5 py-0.5 text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
									onClick={() => {
										handleQuickReaction(emoji).catch(() => {});
									}}
								>
									{emoji}
								</button>
							))}
						</div>
						<EmojiPicker
							variant="inline"
							isOpen
							onClose={() => setPickerOpen(false)}
							onEmojiSelect={emoji => {
								handleEmojiSelect(emoji).catch(() => {});
							}}
						/>
					</div>,
					document.body,
				)
			: null;

	return (
		<>
			<div
				className={`absolute -bottom-1.5 -right-1.5 z-10 transition-opacity ${visible}`}
			>
				<button
					ref={triggerRef}
					type="button"
					onClick={() => {
						setPickerOpen(v => {
							const next = !v;
							if (next) {
								requestAnimationFrame(updatePopoverPosition);
							}
							return next;
						});
					}}
					className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-xs leading-none shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
					aria-label="Add reaction"
					aria-expanded={pickerOpen}
				>
					<span className="text-[11px] leading-none" aria-hidden>
						❤️
					</span>
				</button>
			</div>
			{popover}
		</>
	);
}
