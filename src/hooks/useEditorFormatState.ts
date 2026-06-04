"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
	EMPTY_EDITOR_FORMAT_STATE,
	getEditorFormatState,
	type EditorFormatState,
} from "@/utils/chatRichEditor";

function bindEditorFormatListeners(
	editor: HTMLDivElement,
	editorRef: RefObject<HTMLDivElement | null>,
	refresh: () => void
) {
	const onSelectionChange = () => {
		const anchor = document.getSelection()?.anchorNode;
		if (!anchor || !editorRef.current?.contains(anchor)) {
			return;
		}
		refresh();
	};

	document.addEventListener("selectionchange", onSelectionChange);
	editor.addEventListener("keyup", refresh);
	editor.addEventListener("mouseup", refresh);
	editor.addEventListener("focus", refresh);
	editor.addEventListener("input", refresh);
	refresh();

	return () => {
		document.removeEventListener("selectionchange", onSelectionChange);
		editor.removeEventListener("keyup", refresh);
		editor.removeEventListener("mouseup", refresh);
		editor.removeEventListener("focus", refresh);
		editor.removeEventListener("input", refresh);
	};
}

export function useEditorFormatState(
	editorRef: RefObject<HTMLDivElement | null>,
	refreshKey = 0
) {
	const [formatState, setFormatState] = useState<EditorFormatState>(EMPTY_EDITOR_FORMAT_STATE);

	const refresh = useCallback(() => {
		setFormatState(getEditorFormatState(editorRef.current));
	}, [editorRef]);

	useEffect(() => {
		setFormatState(EMPTY_EDITOR_FORMAT_STATE);
	}, [refreshKey]);

	useEffect(() => {
		let cleanup: (() => void) | undefined;

		const attach = () => {
			const editor = editorRef.current;
			if (!editor) return false;
			cleanup = bindEditorFormatListeners(editor, editorRef, refresh);
			return true;
		};

		if (!attach()) {
			const frame = requestAnimationFrame(() => attach());
			return () => {
				cancelAnimationFrame(frame);
				cleanup?.();
			};
		}

		return () => cleanup?.();
	}, [editorRef, refresh, refreshKey]);

	return { formatState, refreshFormatState: refresh };
}
