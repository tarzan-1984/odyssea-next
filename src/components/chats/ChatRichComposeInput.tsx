"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	clearEditor,
	COMPOSE_EDITOR_MIN_HEIGHT_PX,
	getComposeEditorMaxHeightPx,
	getEditorPlainText,
	htmlToMarkdown,
	isEditorEmpty,
	resetComposeEditorHeight,
} from "@/utils/chatRichEditor";
import {
	filterMentionCandidates,
	findMentionQueryAtCaret,
	mentionNamesFromCandidates,
	type ChatMentionCandidate,
} from "@/utils/chatMentions";
import {
	insertMentionAtQuery,
	readEditorTextAndCaret,
	syncEditorMentions,
} from "@/utils/chatMentionEditor";
import ChatMentionPicker from "./ChatMentionPicker";

const COMPOSE_FIELD_CLASS =
	"w-full min-h-9 max-h-[50cqh] overflow-y-auto py-2 pl-[4.85rem] pr-3 text-sm leading-snug text-gray-800 outline-none dark:text-white/90 sm:pl-[5rem]";

const COMPOSE_FIELD_COMPACT_CLASS =
	"w-full min-h-9 max-h-[50cqh] overflow-y-auto py-2 pl-10 pr-3 text-sm leading-snug text-gray-800 outline-none dark:text-white/90 sm:pl-11";

const COMPOSE_FIELD_NO_LEADING_ICONS_CLASS =
	"w-full min-h-9 max-h-[50cqh] overflow-y-auto py-2 pl-3 pr-3 text-sm leading-snug text-gray-800 outline-none dark:text-white/90";

const PICKER_WIDTH = 280;
const PICKER_MAX_HEIGHT = 240;
const VIEWPORT_PADDING = 8;

function composeFieldClass(leadingIcons: "default" | "compact" | "none"): string {
	if (leadingIcons === "compact") return COMPOSE_FIELD_COMPACT_CLASS;
	if (leadingIcons === "none") return COMPOSE_FIELD_NO_LEADING_ICONS_CLASS;
	return COMPOSE_FIELD_CLASS;
}

function getCaretRect(): DOMRect | null {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0) return null;
	const range = sel.getRangeAt(0).cloneRange();
	range.collapse(true);
	const rects = range.getClientRects();
	if (rects.length > 0) return rects[0];
	const rect = range.getBoundingClientRect();
	if (rect.width || rect.height || rect.top || rect.left) return rect;
	return null;
}

export type ChatRichComposeInputProps = {
	editorRef: React.RefObject<HTMLDivElement | null>;
	onContentChange: (markdown: string, plainText: string) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
	disabled?: boolean;
	placeholder?: string;
	/** Increment to clear editor (e.g. after send). */
	resetKey?: number;
	/** Increment to replace editor content with draftContent. */
	draftKey?: number;
	draftContent?: string;
	/** Left padding for leading action icons in the compose field. */
	leadingIcons?: "default" | "compact" | "none";
	/** @deprecated Prefer leadingIcons="compact" */
	compactLeadingIcons?: boolean;
	mentionCandidates?: ChatMentionCandidate[];
};

export default function ChatRichComposeInput({
	editorRef,
	onContentChange,
	onKeyDown,
	onPaste,
	disabled,
	placeholder = "Type a message",
	resetKey = 0,
	draftKey = 0,
	draftContent = "",
	leadingIcons,
	compactLeadingIcons = false,
	mentionCandidates = [],
}: ChatRichComposeInputProps) {
	const resolvedLeadingIcons =
		leadingIcons ?? (compactLeadingIcons ? "compact" : "default");
	const fieldClass = composeFieldClass(resolvedLeadingIcons);
	const [showPlaceholder, setShowPlaceholder] = useState(true);
	const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(
		null
	);
	const [mentionIndex, setMentionIndex] = useState(0);
	const [pickerPos, setPickerPos] = useState<{
		top?: number;
		bottom?: number;
		left: number;
	} | null>(null);
	const [pickerMounted, setPickerMounted] = useState(false);
	const mentionNames = useMemo(
		() => mentionNamesFromCandidates(mentionCandidates),
		[mentionCandidates]
	);
	const filteredMentions = useMemo(
		() => filterMentionCandidates(mentionCandidates, mentionQuery?.query ?? ""),
		[mentionCandidates, mentionQuery]
	);
	const mentionQueryRef = useRef(mentionQuery);
	const filteredMentionsRef = useRef(filteredMentions);
	const mentionIndexRef = useRef(mentionIndex);
	const syncingMentionsRef = useRef(false);
	mentionQueryRef.current = mentionQuery;
	filteredMentionsRef.current = filteredMentions;
	mentionIndexRef.current = mentionIndex;

	const syncFromEditor = useCallback(() => {
		const el = editorRef.current;
		if (!el) return;
		const markdown = htmlToMarkdown(el.innerHTML);
		const plain = getEditorPlainText(el);
		setShowPlaceholder(isEditorEmpty(el));
		onContentChange(markdown, plain);
	}, [editorRef, onContentChange]);

	const closeMentionPicker = useCallback(() => {
		setMentionQuery(null);
		setPickerPos(null);
		setMentionIndex(0);
	}, []);

	const updateMentionPickerPosition = useCallback(() => {
		const el = editorRef.current;
		if (!el) return;
		const caretRect = getCaretRect();
		const editorRect = el.getBoundingClientRect();
		const anchor = caretRect ?? editorRect;
		let left = anchor.left;
		if (left + PICKER_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
			left = window.innerWidth - PICKER_WIDTH - VIEWPORT_PADDING;
		}
		left = Math.max(VIEWPORT_PADDING, left);

		const spaceAbove = anchor.top - VIEWPORT_PADDING;
		if (spaceAbove >= 120) {
			setPickerPos({
				left,
				bottom: window.innerHeight - anchor.top + 6,
			});
			return;
		}
		setPickerPos({
			left,
			top: anchor.bottom + 6,
		});
	}, [editorRef]);

	const refreshMentionState = useCallback(() => {
		const el = editorRef.current;
		if (!el || mentionNames.length === 0) {
			closeMentionPicker();
			return;
		}
		syncEditorMentions(el, mentionNames);
		const { text, caret } = readEditorTextAndCaret(el);
		const nextQuery = findMentionQueryAtCaret(text, caret, mentionNames);
		if (!nextQuery) {
			closeMentionPicker();
			return;
		}
		setMentionQuery(nextQuery);
		setMentionIndex(0);
		updateMentionPickerPosition();
	}, [closeMentionPicker, editorRef, mentionNames, updateMentionPickerPosition]);

	const insertMention = useCallback(
		(candidate: ChatMentionCandidate) => {
			const el = editorRef.current;
			const query = mentionQueryRef.current;
			if (!el || !query) return;
			const { caret } = readEditorTextAndCaret(el);
			insertMentionAtQuery(el, query.start, caret, candidate.name);
			closeMentionPicker();
			syncFromEditor();
			requestAnimationFrame(() => {
				const node = editorRef.current;
				if (!node) return;
				syncEditorMentions(node, mentionNames);
				syncFromEditor();
			});
		},
		[closeMentionPicker, editorRef, mentionNames, syncFromEditor]
	);

	const prevResetKeyRef = useRef(resetKey);
	const prevDraftKeyRef = useRef(draftKey);

	useEffect(() => {
		setPickerMounted(true);
	}, []);

	useEffect(() => {
		if (resetKey === prevResetKeyRef.current) return;
		prevResetKeyRef.current = resetKey;
		const el = editorRef.current;
		if (!el) return;
		clearEditor(el);
		resetComposeEditorHeight(el);
		setShowPlaceholder(true);
		closeMentionPicker();
		onContentChange("", "");
		requestAnimationFrame(() => {
			const node = editorRef.current;
			if (!node) return;
			resetComposeEditorHeight(node);
		});
	}, [resetKey, editorRef, onContentChange, closeMentionPicker]);

	useEffect(() => {
		if (draftKey === prevDraftKeyRef.current) return;
		prevDraftKeyRef.current = draftKey;
		const el = editorRef.current;
		if (!el) return;
		el.textContent = draftContent;
		setShowPlaceholder(!draftContent.trim());
		if (mentionNames.length > 0) {
			syncEditorMentions(el, mentionNames);
		}
		onContentChange(draftContent, draftContent.trim());
		closeMentionPicker();
		requestAnimationFrame(() => {
			const node = editorRef.current;
			if (!node) return;
			node.focus();
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(node);
			range.collapse(false);
			selection?.removeAllRanges();
			selection?.addRange(range);
			node.style.height = "auto";
			const chatBox = node.closest("[data-chat-box]") as HTMLElement | null;
			const max = getComposeEditorMaxHeightPx(chatBox);
			node.style.height = `${Math.min(
				Math.max(node.scrollHeight, COMPOSE_EDITOR_MIN_HEIGHT_PX),
				max
			)}px`;
		});
	}, [draftKey, draftContent, editorRef, onContentChange, mentionNames, closeMentionPicker]);

	const adjustHeight = useCallback(() => {
		const el = editorRef.current;
		if (!el) return;
		el.style.height = "auto";
		const chatBox = el.closest("[data-chat-box]") as HTMLElement | null;
		const max = getComposeEditorMaxHeightPx(chatBox);
		el.style.height = `${Math.min(Math.max(el.scrollHeight, COMPOSE_EDITOR_MIN_HEIGHT_PX), max)}px`;
	}, [editorRef]);

	useEffect(() => {
		const el = editorRef.current;
		if (!el) return;
		const chatBox = el.closest("[data-chat-box]") as HTMLElement | null;
		if (!chatBox) return;

		const observer = new ResizeObserver(() => {
			adjustHeight();
		});
		observer.observe(chatBox);
		return () => observer.disconnect();
	}, [editorRef, adjustHeight]);

	useEffect(() => {
		if (!mentionQuery) return;
		updateMentionPickerPosition();
		window.addEventListener("resize", updateMentionPickerPosition);
		window.addEventListener("scroll", updateMentionPickerPosition, true);
		return () => {
			window.removeEventListener("resize", updateMentionPickerPosition);
			window.removeEventListener("scroll", updateMentionPickerPosition, true);
		};
	}, [mentionQuery, updateMentionPickerPosition]);

	const handleInput = () => {
		if (syncingMentionsRef.current) return;
		syncingMentionsRef.current = true;
		try {
			refreshMentionState();
		} finally {
			syncingMentionsRef.current = false;
		}
		syncFromEditor();
		adjustHeight();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.nativeEvent.isComposing) {
			onKeyDown(e);
			return;
		}
		if (mentionQuery && filteredMentions.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionIndex(index => (index + 1) % filteredMentions.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setMentionIndex(index =>
					index === 0 ? filteredMentions.length - 1 : index - 1
				);
				return;
			}
			if (e.key === "Enter" || e.key === "Tab") {
				e.preventDefault();
				const candidate =
					filteredMentions[mentionIndexRef.current] ?? filteredMentions[0];
				if (candidate) insertMention(candidate);
				return;
			}
			if (e.key === "Escape") {
				e.preventDefault();
				closeMentionPicker();
				return;
			}
		}
		onKeyDown(e);
	};

	const showPicker =
		Boolean(mentionQuery) && filteredMentions.length > 0 && pickerPos && pickerMounted;

	return (
		<div className="relative min-h-9">
			{showPlaceholder ? (
				<span
					className={`pointer-events-none absolute inset-0 z-0 flex items-start text-sm leading-snug text-gray-400 dark:text-gray-500 ${fieldClass}`}
					aria-hidden
				>
					{placeholder}
				</span>
			) : null}
			<div
				ref={editorRef}
				contentEditable={!disabled}
				role="textbox"
				aria-multiline
				aria-label={placeholder}
				suppressContentEditableWarning
				onInput={handleInput}
				onKeyDown={handleKeyDown}
				onPaste={onPaste}
				onKeyUp={() => {
					if (mentionQueryRef.current) updateMentionPickerPosition();
				}}
				onClick={() => {
					refreshMentionState();
				}}
				onBlur={() => {
					requestAnimationFrame(() => {
						if (!editorRef.current?.contains(document.activeElement)) {
							closeMentionPicker();
						}
					});
				}}
				className={`relative z-0 ${fieldClass} chat-compose-editor empty:min-h-9 disabled:opacity-50`}
			/>
			{showPicker
				? createPortal(
						<ChatMentionPicker
							candidates={filteredMentions}
							selectedIndex={Math.min(mentionIndex, filteredMentions.length - 1)}
							onSelect={insertMention}
							onHoverIndex={setMentionIndex}
							style={{
								position: "fixed",
								left: pickerPos.left,
								top: pickerPos.top,
								bottom: pickerPos.bottom,
								width: PICKER_WIDTH,
								maxHeight: PICKER_MAX_HEIGHT,
							}}
						/>,
						document.body
					)
				: null}
		</div>
	);
}
