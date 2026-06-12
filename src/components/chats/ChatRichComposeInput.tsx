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

export type ChatRichComposeInputProps = {
	editorRef: React.RefObject<HTMLDivElement | null>;
	onContentChange: (markdown: string, plainText: string) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
	onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
	disabled?: boolean;
	placeholder?: string;
	/** Increment to clear editor (e.g. after send). */
	resetKey?: number;
};

export default function ChatRichComposeInput({
	editorRef,
	onContentChange,
	onKeyDown,
	onPaste,
	disabled,
	placeholder = "Type a message",
	resetKey = 0,
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
					className={`pointer-events-none absolute inset-0 z-0 flex items-start text-sm leading-snug text-gray-400 dark:text-gray-500 ${COMPOSE_FIELD_CLASS}`}
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
				className={`relative z-0 ${COMPOSE_FIELD_CLASS} chat-compose-editor empty:min-h-9 disabled:opacity-50`}
			/>
		</div>
	);
}
