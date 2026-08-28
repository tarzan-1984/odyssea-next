import { deleteNewsArticleMediaInBackground, isDeletableNewsArticleMediaUrl } from "@/app-api/deleteNewsArticleMediaInBackground";
import { parseNewsArticleHtml } from "@/components/news-updates/parseNewsArticleHtml";

/** True when article HTML still contains temporary blob preview URLs. */
export function hasUnuploadedNewsArticleMedia(html: string): boolean {
	return /\bsrc\s*=\s*["']blob:/i.test(html);
}

export function extractNewsArticleCloudMediaUrls(html: string): string[] {
	const urls = new Set<string>();

	for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)) {
		const url = match[1]?.trim();
		if (url && isDeletableNewsArticleMediaUrl(url)) {
			urls.add(url);
		}
	}

	for (const part of parseNewsArticleHtml(html)) {
		if (part.type === "textFile" && isDeletableNewsArticleMediaUrl(part.fileUrl)) {
			urls.add(part.fileUrl);
		}
	}

	return [...urls];
}

export function cleanupNewsArticleMediaInBackground(html: string): void {
	for (const url of extractNewsArticleCloudMediaUrls(html)) {
		deleteNewsArticleMediaInBackground(url);
	}
}

/** Deletes cloud media present in `html` but absent from `keepHtml`. */
export function cleanupNewsArticleMediaNotIn(html: string, keepHtml: string): void {
	const keep = new Set(extractNewsArticleCloudMediaUrls(keepHtml));
	for (const url of extractNewsArticleCloudMediaUrls(html)) {
		if (!keep.has(url)) {
			deleteNewsArticleMediaInBackground(url);
		}
	}
}
