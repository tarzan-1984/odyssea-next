const MARKDOWN_LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

/** Plain http(s) or www. URLs not already inside markdown link syntax. */
const PLAIN_URL_RE =
	/(?<!]\()(https?:\/\/[^\s<]+[^\s<.,:;"')\]\s]|www\.[^\s<]+[^\s<.,:;"')\]\s])/gi;

export function normalizeChatHref(raw: string): string {
	const trimmed = raw.trim();
	if (/^www\./i.test(trimmed)) {
		return `https://${trimmed}`;
	}
	return trimmed;
}

export function isAllowedChatHref(href: string): boolean {
	try {
		const url = new URL(normalizeChatHref(href));
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

/** Turn bare URLs into markdown links for react-markdown + GFM. */
export function linkifyPlainUrlsInText(text: string): string {
	return text.replace(PLAIN_URL_RE, raw => {
		const href = normalizeChatHref(raw);
		if (!isAllowedChatHref(href)) {
			return raw;
		}
		return `[${raw}](${href})`;
	});
}

export function preprocessChatMessageLinks(content: string): string {
	if (!content.trim()) {
		return content;
	}

	let result = "";
	let lastIndex = 0;

	for (const match of content.matchAll(MARKDOWN_LINK_RE)) {
		const index = match.index ?? 0;
		result += linkifyPlainUrlsInText(content.slice(lastIndex, index));
		result += match[0];
		lastIndex = index + match[0].length;
	}

	result += linkifyPlainUrlsInText(content.slice(lastIndex));
	return result;
}
