export function isDeletableNewsArticleMediaUrl(fileUrl: string): boolean {
	return /^https?:\/\//i.test(fileUrl) && !/^blob:/i.test(fileUrl);
}

/** Fire-and-forget delete for uploaded news media in object storage. */
export function deleteNewsArticleMediaInBackground(fileUrl: string): void {
	if (!isDeletableNewsArticleMediaUrl(fileUrl)) {
		return;
	}

	fetch(`/api/storage/object?url=${encodeURIComponent(fileUrl)}`, {
		method: "DELETE",
		credentials: "include",
		cache: "no-store",
	}).catch(() => undefined);
}
