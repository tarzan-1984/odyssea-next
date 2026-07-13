"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	clearEditor,
	COMPOSE_EDITOR_MIN_HEIGHT_PX,
	getComposeEditorMaxHeightPx,
	getEditorPlainText,
	htmlToMarkdown,
	isEditorEmpty,
	resetComposeEditorHeight,
} from "@/utils/chatRichEditor";

const COMPOSE_FIELD_CLASS =
	"w-full min-h-9 max-h-[50cqh] overflow-y-auto py-2 pl-[4.85rem] pr-3 text-sm leading-snug text-gray-800 outline-none dark:text-white/90 sm:pl-[5rem]";

const COMPOSE_FIELD_COMPACT_CLASS =
	"w-full min-h-9 max-h-[50cqh] overflow-y-auto py-2 pl-10 pr-3 text-sm leading-snug text-gray-800 outline-none dark:text-white/90 sm:pl-11";

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
	/** Single leading icon (e.g. BID chat) — tighter left padding. */
	compactLeadingIcons?: boolean;
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
	compactLeadingIcons = false,
}: ChatRichComposeInputProps) {
	const [showPlaceholder, setShowPlaceholder] = useState(true);

	const syncFromEditor = useCallback(() => {
		const el = editorRef.current;
		if (!el) return;
		const markdown = htmlToMarkdown(el.innerHTML);
		const plain = getEditorPlainText(el);
		setShowPlaceholder(isEditorEmpty(el));
		onContentChange(markdown, plain);
	}, [editorRef, onContentChange]);

	const prevResetKeyRef = useRef(resetKey);
	const prevDraftKeyRef = useRef(draftKey);

	useEffect(() => {
		if (resetKey === prevResetKeyRef.current) return;
		prevResetKeyRef.current = resetKey;
		const el = editorRef.current;
		if (!el) return;
		clearEditor(el);
		resetComposeEditorHeight(el);
		setShowPlaceholder(true);
		onContentChange("", "");
		requestAnimationFrame(() => {
			const node = editorRef.current;
			if (!node) return;
			resetComposeEditorHeight(node);
		});
	}, [resetKey, editorRef, onContentChange]);

	useEffect(() => {
		if (draftKey === prevDraftKeyRef.current) return;
		prevDraftKeyRef.current = draftKey;
		const el = editorRef.current;
		if (!el) return;
		el.textContent = draftContent;
		setShowPlaceholder(!draftContent.trim());
		onContentChange(draftContent, draftContent.trim());
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
	}, [draftKey, draftContent, editorRef, onContentChange]);

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

	const handleInput = () => {
		syncFromEditor();
		adjustHeight();
	};

	return (
		<div className="relative min-h-9">
			{showPlaceholder ? (
				<span
					className={`pointer-events-none absolute inset-0 z-0 flex items-start text-sm leading-snug text-gray-400 dark:text-gray-500 ${compactLeadingIcons ? COMPOSE_FIELD_COMPACT_CLASS : COMPOSE_FIELD_CLASS}`}
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
				onKeyDown={onKeyDown}
				onPaste={onPaste}
				className={`relative z-0 ${compactLeadingIcons ? COMPOSE_FIELD_COMPACT_CLASS : COMPOSE_FIELD_CLASS} chat-compose-editor empty:min-h-9 disabled:opacity-50`}
			/>
		</div>
	);
}
