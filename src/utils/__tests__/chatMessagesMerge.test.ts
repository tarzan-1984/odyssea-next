import {
	mergeMessageLists,
	messagesTailLagsBehindRoom,
	filterMessagesForRoom,
} from "../chatMessagesMerge";
import type { Message } from "@/app-api/chatApi";
import type { ChatRoom } from "@/app-api/chatApi";

const mk = (id: string, chatRoomId: string, createdAt: string): Message =>
	({
		id,
		chatRoomId,
		createdAt,
		content: id,
		senderId: "u1",
		sender: { id: "u1", firstName: "A", lastName: "B" },
	}) as Message;

describe("mergeMessageLists", () => {
	it("keeps all messages from cache and store (union by id)", () => {
		const cache = [mk("1", "r1", "2026-01-01T10:00:00Z"), mk("2", "r1", "2026-01-01T11:00:00Z")];
		const store = [
			mk("1", "r1", "2026-01-01T10:00:00Z"),
			mk("2", "r1", "2026-01-01T11:00:00Z"),
			mk("3", "r1", "2026-01-01T12:00:00Z"),
		];
		const merged = mergeMessageLists(cache, store);
		expect(merged.map(m => m.id)).toEqual(["1", "2", "3"]);
	});

	it("does not drop store-only messages when cache is smaller", () => {
		const cache = [mk("9", "r1", "2026-01-01T13:00:00Z")];
		const store = [
			mk("1", "r1", "2026-01-01T10:00:00Z"),
			mk("2", "r1", "2026-01-01T11:00:00Z"),
			mk("9", "r1", "2026-01-01T13:00:00Z"),
		];
		const merged = mergeMessageLists(cache, store);
		expect(merged).toHaveLength(3);
	});
});

describe("messagesTailLagsBehindRoom", () => {
	const room = {
		id: "r1",
		lastMessage: mk("last", "r1", "2026-01-01T14:00:00Z"),
	} as ChatRoom;

	it("returns true when local tail id differs from room lastMessage", () => {
		const local = [mk("1", "r1", "2026-01-01T10:00:00Z")];
		expect(messagesTailLagsBehindRoom(room, local)).toBe(true);
	});

	it("returns false when local tail matches room lastMessage", () => {
		const local = [mk("last", "r1", "2026-01-01T14:00:00Z")];
		expect(messagesTailLagsBehindRoom(room, local)).toBe(false);
	});
});

describe("filterMessagesForRoom", () => {
	it("filters by chatRoomId", () => {
		const msgs = [mk("1", "a", "2026-01-01T10:00:00Z"), mk("2", "b", "2026-01-01T11:00:00Z")];
		expect(filterMessagesForRoom(msgs, "a")).toHaveLength(1);
	});
});
