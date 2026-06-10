/** Only one messages HTTP request at a time; abort the previous when switching rooms. */
let inflight: { chatRoomId: string; controller: AbortController } | null = null;

export function mergeAbortSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
	const defined = signals.filter((s): s is AbortSignal => s != null);
	if (defined.length === 0) {
		return new AbortController().signal;
	}
	if (defined.length === 1) {
		return defined[0];
	}
	if (typeof AbortSignal !== "undefined" && "any" in AbortSignal) {
		return (AbortSignal as typeof AbortSignal & { any: (signals: AbortSignal[]) => AbortSignal }).any(
			defined
		);
	}
	const controller = new AbortController();
	const abort = () => controller.abort();
	for (const signal of defined) {
		if (signal.aborted) {
			controller.abort();
			return controller.signal;
		}
		signal.addEventListener("abort", abort, { once: true });
	}
	return controller.signal;
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Returns a combined signal for the active room fetch.
 * Aborts any in-flight messages request for a different room.
 */
export function beginChatMessagesFetch(
	chatRoomId: string,
	externalSignal?: AbortSignal
): AbortSignal {
	if (inflight && inflight.chatRoomId !== chatRoomId) {
		inflight.controller.abort();
	}

	const controller = new AbortController();
	inflight = { chatRoomId, controller };

	if (externalSignal) {
		if (externalSignal.aborted) {
			controller.abort();
		} else {
			externalSignal.addEventListener("abort", () => controller.abort(), {
				once: true,
			});
		}
	}

	return controller.signal;
}

export function endChatMessagesFetch(chatRoomId: string): void {
	if (inflight?.chatRoomId === chatRoomId) {
		inflight = null;
	}
}

/** Wrap getMessages with single-flight + abort propagation. */
export async function fetchChatMessagesHttp(
	chatRoomId: string,
	page: number,
	limit: number,
	options?: { signal?: AbortSignal }
) {
	const signal = beginChatMessagesFetch(chatRoomId, options?.signal);

	try {
		const { chatApi } = await import("@/app-api/chatApi");
		return await chatApi.getMessages(chatRoomId, page, limit, { signal });
	} finally {
		endChatMessagesFetch(chatRoomId);
	}
}
