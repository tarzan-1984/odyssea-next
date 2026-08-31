export const NEWS_ARTICLE_SHELL_CLASS = "news-article-shell";

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SHELL_OPEN_RE =
	/^<div\b[^>]*\bnews-article-shell\b[^>]*>/i;

export function isSafeNewsBackgroundColor(value: string): boolean {
	return HEX_COLOR_RE.test(value.trim());
}

export function normalizeNewsBackgroundColor(value: string): string | null {
	const trimmed = value.trim();
	if (!isSafeNewsBackgroundColor(trimmed)) return null;
	if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
		return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
	}
	return trimmed.toLowerCase();
}

function readTagAttr(tag: string, attributeName: string): string | null {
	const match = tag.match(new RegExp(`\\b${attributeName}\\s*=\\s*"([^"]*)"`, "i"));
	return match?.[1] ?? null;
}

function readBackgroundFromShellTag(tag: string): string | null {
	const fromData = normalizeNewsBackgroundColor(readTagAttr(tag, "data-news-bg") ?? "");
	if (fromData) return fromData;

	const style = readTagAttr(tag, "style") ?? "";
	const styleMatch = style.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8})/i);
	return styleMatch ? normalizeNewsBackgroundColor(styleMatch[1]) : null;
}

export function unwrapNewsArticleShell(html: string): {
	backgroundColor: string | null;
	innerHtml: string;
} {
	const trimmed = html.trim();
	const openMatch = trimmed.match(SHELL_OPEN_RE);
	if (!openMatch || !trimmed.toLowerCase().endsWith("</div>")) {
		return { backgroundColor: null, innerHtml: html };
	}

	return {
		backgroundColor: readBackgroundFromShellTag(openMatch[0]),
		innerHtml: trimmed.slice(openMatch[0].length, trimmed.length - "</div>".length),
	};
}

export function wrapNewsArticleShell(
	innerHtml: string,
	backgroundColor: string | null,
): string {
	const unwrapped = unwrapNewsArticleShell(innerHtml).innerHtml;
	const hex = backgroundColor ? normalizeNewsBackgroundColor(backgroundColor) : null;
	if (!hex) return unwrapped;
	return `<div class="${NEWS_ARTICLE_SHELL_CLASS}" data-news-bg="${hex}" style="background-color: ${hex}">${unwrapped}</div>`;
}
