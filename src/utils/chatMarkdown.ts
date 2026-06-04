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

function getLineRangeAt(value: string, index: number): { start: number; end: number } {
	const lineStart = value.lastIndexOf("\n", index - 1) + 1;
	const nextBreak = value.indexOf("\n", index);
	const lineEnd = nextBreak === -1 ? value.length : nextBreak;
	return { start: lineStart, end: lineEnd };
}

function getBlockLineRange(value: string, selectionStart: number, selectionEnd: number) {
	const startLine = getLineRangeAt(value, selectionStart);
	const endLine = getLineRangeAt(value, Math.max(selectionStart, selectionEnd - 1));
	return { start: startLine.start, end: endLine.end };
}

const BULLET_RE = /^(\s*)[-*+]\s+/;
const ORDERED_RE = /^(\s*)\d+\.\s+/;

export function toggleBulletList(
	value: string,
	selectionStart: number,
	selectionEnd: number
): { nextValue: string; selectionStart: number; selectionEnd: number } {
	return toggleListPrefix(value, selectionStart, selectionEnd, "- ");
}

export function toggleOrderedList(
	value: string,
	selectionStart: number,
	selectionEnd: number
): { nextValue: string; selectionStart: number; selectionEnd: number } {
	const { start, end } = getBlockLineRange(value, selectionStart, selectionEnd);
	const block = value.slice(start, end);
	const lines = block.split("\n");
	const allOrdered = lines.every(line => line.trim() === "" || ORDERED_RE.test(line));

	let lineIndex = 0;
	const nextLines = lines.map(line => {
		if (line.trim() === "") return line;
		lineIndex += 1;
		if (allOrdered) {
			return line.replace(ORDERED_RE, "$1");
		}
		const indent = line.match(/^(\s*)/)?.[1] ?? "";
		const stripped = line.replace(BULLET_RE, "").replace(ORDERED_RE, "");
		return `${indent}${lineIndex}. ${stripped}`;
	});

	const nextBlock = nextLines.join("\n");
	const nextValue = value.slice(0, start) + nextBlock + value.slice(end);
	return {
		nextValue,
		selectionStart: start,
		selectionEnd: start + nextBlock.length,
	};
}

function toggleListPrefix(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	prefix: string
): { nextValue: string; selectionStart: number; selectionEnd: number } {
	const { start, end } = getBlockLineRange(value, selectionStart, selectionEnd);
	const block = value.slice(start, end);
	const lines = block.split("\n");
	const bulletRe = new RegExp(`^(\\s*)${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
	const allHavePrefix = lines.every(line => line.trim() === "" || bulletRe.test(line));

	const nextLines = lines.map(line => {
		if (line.trim() === "") return line;
		if (allHavePrefix) {
			return line.replace(bulletRe, "$1");
		}
		const indent = line.match(/^(\s*)/)?.[1] ?? "";
		const stripped = line.replace(BULLET_RE, "").replace(ORDERED_RE, "");
		return `${indent}${prefix}${stripped}`;
	});

	const nextBlock = nextLines.join("\n");
	const nextValue = value.slice(0, start) + nextBlock + value.slice(end);
	return {
		nextValue,
		selectionStart: start,
		selectionEnd: start + nextBlock.length,
	};
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
	text = text.replace(/\*\*([\s\S]*?)\*\*/g, "$1");
	text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
	text = text.replace(/~~([\s\S]*?)~~/g, "$1");
	text = text.replace(/^[\t ]*[-*+]\s+/gm, "");
	text = text.replace(/^[\t ]*\d+\.\s+/gm, "");
	text = text.replace(/\n{3,}/g, "\n\n");
	return text.trim();
}
