import type { ChatRoom } from "@/app-api/chatApi";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";

export const CHECK_LIST_BULK_CHAT_BATCH_SIZE = 5;
const CHECK_LIST_BULK_CHAT_REQUEST_TIMEOUT_MS = 120_000;

export type BulkDirectChatsSummary = {
	created: number;
	existed: number;
	errors: number;
	messagesSent?: number;
	messageErrors?: number;
	items: Array<{
		driverUserId: string;
		status: "created" | "existed" | "error";
		chatRoom?: Record<string, unknown>;
		messageSent?: boolean;
		messageId?: string;
		messageError?: string;
	}>;
};

export type BulkDirectChatsProgress = {
	completed: number;
	total: number;
};

export function normalizeBulkDirectChatRoom(raw: Record<string, unknown>): ChatRoom {
	const participants = Array.isArray(raw.participants) ? raw.participants : [];
	const createdAt =
		typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString();

	return {
		id: String(raw.id ?? ""),
		name: typeof raw.name === "string" ? raw.name : undefined,
		type: String(raw.type ?? "DIRECT"),
		loadId: typeof raw.loadId === "string" ? raw.loadId : undefined,
		avatar: typeof raw.avatar === "string" ? raw.avatar : undefined,
		isArchived: false,
		createdAt,
		updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt,
		participants: participants.map((p: Record<string, unknown>) => {
			const user = (p.user ?? {}) as Record<string, unknown>;
			const userId = String(user.id ?? p.userId ?? "");
			return {
				id: String(p.id ?? `participant_${userId}_${raw.id}`),
				chatRoomId: String(raw.id ?? ""),
				userId,
				joinedAt: typeof p.joinedAt === "string" ? p.joinedAt : createdAt,
				user: {
					id: userId,
					firstName: String(user.firstName ?? ""),
					lastName: String(user.lastName ?? ""),
					avatar: String(user.profilePhoto ?? user.avatar ?? ""),
					role: typeof user.role === "string" ? user.role : undefined,
				},
			};
		}),
		unreadCount: 0,
	};
}

function chunkDriverIds(driverUserIds: string[], batchSize: number): string[][] {
	const chunks: string[][] = [];
	for (let i = 0; i < driverUserIds.length; i += batchSize) {
		chunks.push(driverUserIds.slice(i, i + batchSize));
	}
	return chunks;
}

function mergeBulkSummaries(summaries: BulkDirectChatsSummary[]): BulkDirectChatsSummary {
	return summaries.reduce<BulkDirectChatsSummary>(
		(acc, summary) => ({
			created: acc.created + summary.created,
			existed: acc.existed + summary.existed,
			errors: acc.errors + summary.errors,
			messagesSent: (acc.messagesSent ?? 0) + (summary.messagesSent ?? 0),
			messageErrors: (acc.messageErrors ?? 0) + (summary.messageErrors ?? 0),
			items: [...acc.items, ...summary.items],
		}),
		{ created: 0, existed: 0, errors: 0, items: [] },
	);
}

async function fetchBulkDirectChatsWithMessage(
	driverUserIds: string[],
	message?: string,
	signal?: AbortSignal,
): Promise<BulkDirectChatsSummary> {
	const trimmed = message?.trim() ?? "";
	const res = await fetch("/api/chat-rooms/direct/bulk-with-message", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		signal,
		body: JSON.stringify({
			driverUserIds,
			...(trimmed ? { message: trimmed } : {}),
		}),
	});

	const json = (await res.json().catch(() => ({}))) as BulkDirectChatsSummary & {
		error?: string;
	};

	if (!res.ok) {
		throw new Error(json.error || "Failed to create private chats");
	}

	return json;
}

export async function bulkCreatePrivateChatsWithMessage(
	driverUserIds: string[],
	message?: string,
	onProgress?: (progress: BulkDirectChatsProgress) => void,
): Promise<BulkDirectChatsSummary> {
	const uniqueIds = [...new Set(driverUserIds.filter(id => id.trim() !== ""))];
	if (uniqueIds.length === 0) {
		return { created: 0, existed: 0, errors: 0, items: [] };
	}

	const batches = chunkDriverIds(uniqueIds, CHECK_LIST_BULK_CHAT_BATCH_SIZE);
	const summaries: BulkDirectChatsSummary[] = [];
	let completed = 0;

	onProgress?.({ completed: 0, total: uniqueIds.length });

	for (const batch of batches) {
		const controller = new AbortController();
		const timeoutId = window.setTimeout(
			() => controller.abort(),
			CHECK_LIST_BULK_CHAT_REQUEST_TIMEOUT_MS,
		);

		try {
			const summary = await fetchBulkDirectChatsWithMessage(
				batch,
				message,
				controller.signal,
			);
			summaries.push(summary);
			completed += batch.length;
			onProgress?.({ completed, total: uniqueIds.length });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new Error(
					`Request timed out after processing ${completed} of ${uniqueIds.length} drivers. Please try again with fewer drivers selected.`,
				);
			}
			throw error;
		} finally {
			window.clearTimeout(timeoutId);
		}
	}

	return mergeBulkSummaries(summaries);
}

export function showBulkPrivateChatsToast(summary: BulkDirectChatsSummary): void {
	const addSystemToast = (window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void })
		.addSystemToastNotification;

	if (typeof addSystemToast !== "function") return;

	const { created, existed, errors, messagesSent, messageErrors } = summary;
	let message = `Created: ${created}, already existed: ${existed}, errors: ${errors}`;
	if (typeof messagesSent === "number") {
		message += `, messages sent: ${messagesSent}`;
	}
	if (typeof messageErrors === "number" && messageErrors > 0) {
		message += `, message errors: ${messageErrors}`;
	}

	addSystemToast({
		id: `check-list-bulk-chats-${Date.now()}`,
		title: "Private chats",
		message,
		variant: created > 0 || (messagesSent ?? 0) > 0 ? "success" : errors > 0 ? "error" : "default",
	});
}
