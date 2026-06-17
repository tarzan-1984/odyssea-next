import type { Message } from "@/app-api/chatApi";

const OUTBOX_STORAGE_KEY = "odyssea_chat_message_outbox_v1";

export type OutboxMessageKind = "text" | "media";

export type OutboxUploadedAttachment = {
	fileUrl: string;
	fileName: string;
	fileSize: number;
};

export type ChatOutboxItem = {
	clientMessageId: string;
	chatRoomId: string;
	kind: OutboxMessageKind;
	content: string;
	replyData?: Message["replyData"];
	uploadedAttachments?: OutboxUploadedAttachment[];
	status: "uploading" | "sending" | "failed";
	serverMessageId?: string;
	createdAt: string;
	retryCount: number;
};

class ChatOutboxService {
	private readAll(): ChatOutboxItem[] {
		if (typeof window === "undefined") return [];
		try {
			const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
			if (!raw) return [];
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as ChatOutboxItem[]) : [];
		} catch {
			return [];
		}
	}

	private writeAll(items: ChatOutboxItem[]): void {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
	}

	async getAll(): Promise<ChatOutboxItem[]> {
		return this.readAll();
	}

	async getForRoom(chatRoomId: string): Promise<ChatOutboxItem[]> {
		return this.readAll()
			.filter(item => item.chatRoomId === chatRoomId)
			.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}

	async getPending(): Promise<ChatOutboxItem[]> {
		return this.readAll().filter(
			item => item.status === "uploading" || item.status === "sending"
		);
	}

	async upsert(item: ChatOutboxItem): Promise<void> {
		const all = this.readAll();
		const index = all.findIndex(row => row.clientMessageId === item.clientMessageId);
		if (index >= 0) {
			all[index] = item;
		} else {
			all.push(item);
		}
		this.writeAll(all);
	}

	async patch(
		clientMessageId: string,
		patch: Partial<ChatOutboxItem>
	): Promise<ChatOutboxItem | null> {
		const all = this.readAll();
		const index = all.findIndex(row => row.clientMessageId === clientMessageId);
		if (index < 0) return null;
		const next = { ...all[index], ...patch };
		all[index] = next;
		this.writeAll(all);
		return next;
	}

	async remove(clientMessageId: string): Promise<void> {
		const all = this.readAll();
		const next = all.filter(row => row.clientMessageId !== clientMessageId);
		if (next.length === all.length) return;
		this.writeAll(next);
	}

	async markAcknowledged(clientMessageId: string, serverMessageId: string): Promise<void> {
		await this.patch(clientMessageId, { serverMessageId, status: "sending" });
	}

	async markFailed(clientMessageId: string): Promise<void> {
		const item = await this.patch(clientMessageId, { status: "failed" });
		if (!item) return;
		await this.patch(clientMessageId, { retryCount: (item.retryCount ?? 0) + 1 });
	}

	async clearAll(): Promise<void> {
		if (typeof window === "undefined") return;
		window.localStorage.removeItem(OUTBOX_STORAGE_KEY);
	}
}

export const chatOutboxService = new ChatOutboxService();

export function createClientMessageId(): string {
	return `cmid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
}
