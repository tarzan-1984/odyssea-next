import { findMentionMatches, getChatMentionClassName } from "@/utils/chatMentions";

const MENTION_CLASS = getChatMentionClassName();

function isBlockElement(el: Element): boolean {
	const tag = el.tagName.toLowerCase();
	return tag === "div" || tag === "p" || tag === "li" || tag === "blockquote" || tag === "pre";
}

function visitEditorText(
	root: HTMLElement,
	onText: (node: Text, value: string) => void,
	onNewline: () => void
): void {
	const visit = (node: Node, isRoot = false) => {
		if (node.nodeType === Node.TEXT_NODE) {
			onText(node as Text, (node.textContent || "").replace(/\u00a0/g, " "));
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const el = node as Element;
		if (el.tagName.toLowerCase() === "br") {
			onNewline();
			return;
		}
		const children = Array.from(el.childNodes);
		for (let i = 0; i < children.length; i += 1) {
			const child = children[i];
			if (
				!isRoot &&
				i > 0 &&
				child.nodeType === Node.ELEMENT_NODE &&
				isBlockElement(child as Element)
			) {
				onNewline();
			}
			visit(child);
		}
	};

	visit(root, true);
}

export function readEditorTextAndCaret(editor: HTMLElement): { text: string; caret: number } {
	const sel = window.getSelection();
	const anchorNode = sel?.anchorNode ?? null;
	const anchorOffset = sel?.anchorOffset ?? 0;
	let text = "";
	let caret = 0;
	let caretSet = false;

	const markCaret = (nextCaret: number) => {
		if (caretSet) return;
		caret = nextCaret;
		caretSet = true;
	};

	const visit = (node: Node, isRoot = false) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const value = (node.textContent || "").replace(/\u00a0/g, " ");
			if (!caretSet && node === anchorNode) {
				markCaret(text.length + Math.min(anchorOffset, value.length));
			}
			text += value;
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		const el = node as Element;
		if (el.tagName.toLowerCase() === "br") {
			if (!caretSet && el === anchorNode) markCaret(text.length);
			text += "\n";
			return;
		}
		const children = Array.from(el.childNodes);
		for (let i = 0; i < children.length; i += 1) {
			if (!caretSet && anchorNode === el && anchorOffset === i) {
				markCaret(text.length);
			}
			const child = children[i];
			if (
				!isRoot &&
				i > 0 &&
				child.nodeType === Node.ELEMENT_NODE &&
				isBlockElement(child as Element)
			) {
				text += "\n";
			}
			visit(child);
		}
		if (!caretSet && anchorNode === el && anchorOffset >= children.length) {
			markCaret(text.length);
		}
	};

	visit(editor, true);
	if (!caretSet) caret = text.length;
	return { text, caret };
}

export function setEditorCaret(editor: HTMLElement, target: number): void {
	let count = 0;
	let placed = false;

	const placeInText = (node: Text, offset: number) => {
		const range = document.createRange();
		range.setStart(node, Math.max(0, Math.min(offset, node.textContent?.length ?? 0)));
		range.collapse(true);
		const sel = window.getSelection();
		sel?.removeAllRanges();
		sel?.addRange(range);
		placed = true;
	};

	const visit = (node: Node, isRoot = false): boolean => {
		if (placed) return true;
		if (node.nodeType === Node.TEXT_NODE) {
			const value = node.textContent || "";
			if (count + value.length >= target) {
				placeInText(node as Text, target - count);
				return true;
			}
			count += value.length;
			return false;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return false;
		const el = node as Element;
		if (el.tagName.toLowerCase() === "br") {
			if (count >= target) {
				const range = document.createRange();
				range.setStartBefore(el);
				range.collapse(true);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
				placed = true;
				return true;
			}
			count += 1;
			return false;
		}
		const children = Array.from(el.childNodes);
		for (let i = 0; i < children.length; i += 1) {
			const child = children[i];
			if (
				!isRoot &&
				i > 0 &&
				child.nodeType === Node.ELEMENT_NODE &&
				isBlockElement(child as Element)
			) {
				count += 1;
			}
			if (visit(child)) return true;
		}
		return false;
	};

	if (visit(editor, true)) return;

	const range = document.createRange();
	range.selectNodeContents(editor);
	range.collapse(false);
	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}

function setEditorSelection(editor: HTMLElement, start: number, end: number): void {
	const sel = window.getSelection();
	if (!sel) return;
	setEditorCaret(editor, start);
	const startRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
	setEditorCaret(editor, end);
	const endRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
	if (!startRange || !endRange) return;
	const range = document.createRange();
	range.setStart(startRange.startContainer, startRange.startOffset);
	range.setEnd(endRange.startContainer, endRange.startOffset);
	sel.removeAllRanges();
	sel.addRange(range);
}

function closestMentionSpan(node: Node | null, editor: HTMLElement): HTMLElement | null {
	let current: Node | null = node;
	while (current && current !== editor) {
		if (
			current.nodeType === Node.ELEMENT_NODE &&
			(current as HTMLElement).classList?.contains(MENTION_CLASS)
		) {
			return current as HTMLElement;
		}
		current = current.parentNode;
	}
	return null;
}

function unwrapInvalidMentions(editor: HTMLElement, names: string[]): void {
	const spans = Array.from(editor.querySelectorAll(`span.${MENTION_CLASS}`));
	for (const span of spans) {
		const text = (span.textContent || "").replace(/\u00a0/g, " ");
		const matches = findMentionMatches(text, names);
		const valid = matches.some(match => match.start === 0 && match.end === text.length);
		if (valid) continue;
		const textNode = document.createTextNode(span.textContent || "");
		span.parentNode?.replaceChild(textNode, span);
	}
}

function wrapMatchesInEditor(editor: HTMLElement, names: string[]): void {
	const textNodes: Text[] = [];
	visitEditorText(
		editor,
		node => {
			if (!closestMentionSpan(node, editor)) {
				textNodes.push(node);
			}
		},
		() => undefined
	);

	for (const textNode of textNodes) {
		if (!textNode.parentNode || !editor.contains(textNode)) continue;
		const value = (textNode.textContent || "").replace(/\u00a0/g, " ");
		const matches = findMentionMatches(value, names);
		if (matches.length === 0) continue;

		const fragment = document.createDocumentFragment();
		let lastIndex = 0;
		for (const match of matches) {
			if (match.start > lastIndex) {
				fragment.appendChild(document.createTextNode(value.slice(lastIndex, match.start)));
			}
			const span = document.createElement("span");
			span.className = MENTION_CLASS;
			span.textContent = value.slice(match.start, match.end);
			fragment.appendChild(span);
			lastIndex = match.end;
		}
		if (lastIndex < value.length) {
			fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
		}
		textNode.parentNode.replaceChild(fragment, textNode);
	}
}

export function syncEditorMentions(editor: HTMLElement, names: string[]): void {
	const { caret } = readEditorTextAndCaret(editor);
	unwrapInvalidMentions(editor, names);
	wrapMatchesInEditor(editor, names);
	setEditorCaret(editor, caret);
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function insertMentionAtQuery(
	editor: HTMLElement,
	queryStart: number,
	queryEnd: number,
	name: string
): void {
	editor.focus();
	setEditorSelection(editor, queryStart, queryEnd);
	const html = `<span class="${MENTION_CLASS}">@${escapeHtml(name)}</span>\u00a0`;
	const inserted = document.execCommand("insertHTML", false, html);
	if (!inserted) {
		const { text } = readEditorTextAndCaret(editor);
		const next = `${text.slice(0, queryStart)}@${name} ${text.slice(queryEnd)}`;
		editor.textContent = next;
		setEditorCaret(editor, queryStart + name.length + 2);
	}
}
