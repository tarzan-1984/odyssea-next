import type { Message } from "@/app-api/chatApi";
import { isOptimisticMessageId } from "@/utils/optimisticChatMessage";

type LastMessageLike = Pick<Message, "id" | "createdAt"> &
	Partial<Pick<Message, "pendingOutgoing">>;

type PickLastMessageOptions = {
	/**
	 * When true (cache↔store merge), keep a strictly newer store lastMessage
	 * for WebSocket races. When false (API merge, default), source/API wins
	 * so ghost previews after deletes are cleared.
	 */
	preferNewerStore?: boolean;
};

/**
 * Merge lastMessage from a source (API or cache) with the local store copy.
 */
export function pickAuthoritativeLastMessage<T extends LastMessageLike>(
	sourceLast: T | null | undefined,
	storeLast: T | null | undefined,
	options: PickLastMessageOptions = {}
): T | null | undefined {
	const preferNewerStore = options.preferNewerStore === true;
	const storeIsOptimistic =
		!!storeLast &&
		(!!storeLast.pendingOutgoing || isOptimisticMessageId(storeLast.id));

	if (sourceLast === null) {
		return storeIsOptimistic ? storeLast : null;
	}

	if (!sourceLast) {
		return storeLast;
	}

	if (!storeLast) {
		return sourceLast;
	}

	if (storeLast.id === sourceLast.id) {
		return { ...storeLast, ...sourceLast };
	}

	if (storeIsOptimistic) {
		const storeTime = new Date(storeLast.createdAt).getTime();
		const sourceTime = new Date(sourceLast.createdAt).getTime();
		if (storeTime >= sourceTime) {
			return storeLast;
		}
	}

	if (preferNewerStore) {
		const storeTime = new Date(storeLast.createdAt).getTime();
		const sourceTime = new Date(sourceLast.createdAt).getTime();
		if (storeTime > sourceTime) {
			return storeLast;
		}
	}

	return sourceLast;
}

/**
 * After loading the newest messages page from the server, align chat-list
 * preview with the actual transcript tail (drops deleted/ghost lastMessage).
 */
export function lastMessageFromTranscriptTail(
	messages: LastMessageLike[]
): LastMessageLike | null {
	if (!messages.length) return null;
	let newest = messages[0];
	let newestTime = new Date(newest.createdAt).getTime();
	for (let i = 1; i < messages.length; i++) {
		const t = new Date(messages[i].createdAt).getTime();
		if (t >= newestTime) {
			newest = messages[i];
			newestTime = t;
		}
	}
	return newest;
}
