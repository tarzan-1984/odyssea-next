export type MarkdownWrapKind = "bold" | "italic" | "underline" | "strike";

const WRAP_SYNTAX: Record<MarkdownWrapKind, { before: string; after: string }> = {
	bold: { before: "**", after: "**" },
	italic: { before: "*", after: "*" },
	underline: { before: "<u>", after: "</u>" },
	strike: { before: "~~", after: "~~" },
};

export function wrapTextSelection(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	kind: MarkdownWrapKind
): { nextValue: string; selectionStart: number; selectionEnd: number } {
	const { before, after } = WRAP_SYNTAX[kind];
	const selected = value.slice(selectionStart, selectionEnd);
	const placeholder = kind === "underline" ? "text" : kind;
	const inner = selected.length > 0 ? selected : placeholder;
	const wrapped = `${before}${inner}${after}`;
	const nextValue = value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
	const nextStart = selectionStart + before.length;
	const nextEnd = nextStart + inner.length;
	return { nextValue, selectionStart: nextStart, selectionEnd: nextEnd };
}

/**
 * Chat supports bold/italic/underline/strike only — escape list markers so
 * CommonMark does not treat phone numbers (e.g. `215) 380-9284`) as lists.
 */
export function escapeChatListSyntax(content: string): string {
	if (!content) return content;

	return content
		.replace(
			/^(\s*)(\d+)([.)])(\s+)/gm,
			(_, indent, num, marker, space) => `${indent}${num}\\${marker}${space}`
		)
		.replace(
			/^(\s*)([-*+])(\s+)/gm,
			(_, indent, marker, space) => `${indent}\\${marker}${space}`
		);
}

/** Closes unclosed markers so compose preview shows styles while typing. */
export function balanceMarkdownForPreview(content: string): string {
	if (!content) return content;

	let preview = content;
	const countDelim = (text: string, delim: string) => {
		const escaped = delim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		return (text.match(new RegExp(escaped, "g")) ?? []).length;
	};

	if (countDelim(preview, "**") % 2 === 1) {
		preview += "**";
	}
	if (countDelim(preview, "~~") % 2 === 1) {
		preview += "~~";
	}

	const openU = (preview.match(/<u>/gi) ?? []).length;
	const closeU = (preview.match(/<\/u>/gi) ?? []).length;
	if (openU > closeU) {
		preview += "</u>";
	}

	// Single-asterisk italic (avoid ** pairs)
	const withoutBold = preview.replace(/\*\*/g, "");
	if (countDelim(withoutBold, "*") % 2 === 1) {
		preview += "*";
	}

	return preview;
}

/** Plain text for chat list previews and notifications. */
export function stripMarkdown(content: string): string {
	if (!content) return "";

	let text = content;
	text = text.replace(/<u>([\s\S]*?)<\/u>/gi, "$1");
	text = text.replace(/\*\*\*([\s\S]*?)\*\*\*/g, "$1");
	text = text.replace(/\*\*([\s\S]*?)\*\*/g, "$1");
	text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
	text = text.replace(/~~([\s\S]*?)~~/g, "$1");
	text = text.replace(/^[\t ]*[-*+]\s+/gm, "");
	text = text.replace(/^[\t ]*\d+[.)]\s+/gm, "");
	text = text.replace(/\*{1,3}/g, "");
	text = text.replace(/\n{3,}/g, "\n\n");
	return text.trim();
}
