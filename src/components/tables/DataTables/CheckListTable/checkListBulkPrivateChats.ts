import type { ChatRoom } from "@/app-api/chatApi";
import type { SystemToastData } from "@/components/notifications/SystemToastNotification";

export type BulkDirectChatsSummary = {
	created: number;
	existed: number;
	errors: number;
	items: Array<{
		driverUserId: string;
		status: "created" | "existed" | "error";
		chatRoom?: Record<string, unknown>;
	}>;
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

export async function bulkCreatePrivateChats(
	driverUserIds: string[]
): Promise<BulkDirectChatsSummary> {
	const res = await fetch("/api/chat-rooms/direct/bulk", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ driverUserIds }),
	});

	const json = (await res.json().catch(() => ({}))) as BulkDirectChatsSummary & {
		error?: string;
	};

	if (!res.ok) {
		throw new Error(json.error || "Failed to create private chats");
	}

	return json;
}

export function showBulkPrivateChatsToast(summary: BulkDirectChatsSummary): void {
	const addSystemToast = (window as unknown as { addSystemToastNotification?: (n: SystemToastData) => void })
		.addSystemToastNotification;

	if (typeof addSystemToast !== "function") return;

	const { created, existed, errors } = summary;
	const message = `Created: ${created}, already existed: ${existed}, errors: ${errors}`;

	addSystemToast({
		id: `check-list-bulk-chats-${Date.now()}`,
		title: "Private chats",
		message,
		variant: created > 0 ? "success" : errors > 0 ? "error" : "default",
	});
}
