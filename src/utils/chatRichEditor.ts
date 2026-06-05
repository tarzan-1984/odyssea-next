import { getPlainTextFromHtml, htmlToMarkdown } from "@/utils/chatHtmlToMarkdown";

type FormatWrapKind = "bold" | "italic" | "underline" | "strike";

export type RichEditorFormatAction = { type: "wrap"; kind: FormatWrapKind };

export { htmlToMarkdown, getPlainTextFromHtml };

export type EditorFormatCommand = "bold" | "italic" | "underline" | "strikeThrough";

export function formatActionToCommand(action: RichEditorFormatAction): EditorFormatCommand | null {
	if (action.type === "wrap") {
		switch (action.kind) {
			case "bold":
				return "bold";
			case "italic":
				return "italic";
			case "underline":
				return "underline";
			case "strike":
				return "strikeThrough";
			default:
				return null;
		}
	}
	return null;
}

export function applyEditorFormat(command: EditorFormatCommand): void {
	document.execCommand(command, false);
}

export function getEditorPlainText(editor: HTMLElement | null): string {
	if (!editor) return "";
	return editor.innerText.replace(/\u00a0/g, " ").trim();
}

export function isEditorEmpty(editor: HTMLElement | null): boolean {
	return getEditorPlainText(editor).length === 0;
}

export function insertTextAtSelection(editor: HTMLElement | null, text: string): void {
	if (!editor || !text) return;
	editor.focus();
	document.execCommand("insertText", false, text);
}

export function clearEditor(editor: HTMLElement | null): void {
	if (!editor) return;
	editor.innerHTML = "";
}

export type EditorFormatState = {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	strikeThrough: boolean;
};

export const EMPTY_EDITOR_FORMAT_STATE: EditorFormatState = {
	bold: false,
	italic: false,
	underline: false,
	strikeThrough: false,
};

function selectionIsInsideEditor(editor: HTMLElement): boolean {
	const sel = window.getSelection();
	if (!sel?.anchorNode) return false;
	return editor.contains(sel.anchorNode);
}

/** Reflects active formats at caret/selection (queryCommandState). */
export function getEditorFormatState(editor: HTMLElement | null): EditorFormatState {
	if (!editor || !selectionIsInsideEditor(editor)) {
		return EMPTY_EDITOR_FORMAT_STATE;
	}

	try {
		return {
			bold: document.queryCommandState("bold"),
			italic: document.queryCommandState("italic"),
			underline: document.queryCommandState("underline"),
			strikeThrough: document.queryCommandState("strikeThrough"),
		};
	} catch {
		return EMPTY_EDITOR_FORMAT_STATE;
	}
}
