import type { Message } from "@/app-api/chatApi";

/** Messages injected into the store per archive scroll (matches PG page size). */
export const ARCHIVE_CHUNK_SIZE = 50;

export interface ArchivedDayCacheEntry {
	messages: Message[];
	/** How many messages from the newest end of the day are already in the store. */
	loadedFromTail: number;
}

export function archiveDayKey(year: number, month: number, day: number): string {
	return `${year}-${month}-${day}`;
}

export function archiveDayHasRemaining(entry: ArchivedDayCacheEntry): boolean {
	return entry.loadedFromTail < entry.messages.length;
}

/**
 * Take the next chunk from the end of a day (newest first), connecting to the current scroll buffer.
 * Day messages must be sorted oldest → newest.
 */
export function takeNextArchiveChunk(
	dayMessages: Message[],
	loadedFromTail: number,
	chunkSize: number = ARCHIVE_CHUNK_SIZE
): { chunk: Message[]; nextLoadedFromTail: number } {
	const remaining = dayMessages.length - loadedFromTail;
	if (remaining <= 0) {
		return { chunk: [], nextLoadedFromTail: loadedFromTail };
	}

	const take = Math.min(chunkSize, remaining);
	const start = dayMessages.length - loadedFromTail - take;
	return {
		chunk: dayMessages.slice(start, start + take),
		nextLoadedFromTail: loadedFromTail + take,
	};
}

export function sortArchiveDayMessages(messages: Message[]): Message[] {
	return [...messages].sort(
		(a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
	);
}
