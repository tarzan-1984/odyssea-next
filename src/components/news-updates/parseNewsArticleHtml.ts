export type NewsArticleHtmlPart =
	| { type: "html"; content: string }
	| {
			type: "textFile";
			fileUrl: string;
			fileName: string;
			fileSize?: number;
	  };

const TEXT_FILE_BLOCK_RE =
	/<div\b[^>]*\bnews-text-file\b[^>]*>\s*<\/div>/gi;

function readDataAttribute(tag: string, attributeName: string): string | null {
	const match = tag.match(
		new RegExp(`\\b${attributeName}\\s*=\\s*"([^"]*)"`, "i"),
	);
	return match?.[1] ?? null;
}

export function parseNewsArticleHtml(html: string): NewsArticleHtmlPart[] {
	const parts: NewsArticleHtmlPart[] = [];
	let lastIndex = 0;

	for (const match of html.matchAll(TEXT_FILE_BLOCK_RE)) {
		const index = match.index ?? 0;

		if (index > lastIndex) {
			parts.push({ type: "html", content: html.slice(lastIndex, index) });
		}

		const tag = match[0];
		const fileUrl = readDataAttribute(tag, "data-file-url");
		const fileName = readDataAttribute(tag, "data-file-name") ?? "file";
		const fileSizeRaw = readDataAttribute(tag, "data-file-size");
		const fileSize = fileSizeRaw ? Number(fileSizeRaw) : undefined;

		if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
			parts.push({
				type: "textFile",
				fileUrl,
				fileName,
				fileSize: Number.isFinite(fileSize) ? fileSize : undefined,
			});
		}

		lastIndex = index + tag.length;
	}

	if (lastIndex < html.length) {
		parts.push({ type: "html", content: html.slice(lastIndex) });
	}

	return parts.length > 0 ? parts : [{ type: "html", content: html }];
}
