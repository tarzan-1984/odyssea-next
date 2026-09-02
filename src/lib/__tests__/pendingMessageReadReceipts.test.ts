import type { Message } from "@/app-api/chatApi";
import {
	applyPendingReadsToMessage,
	applyPendingReadsToMessages,
	resetPendingMessageReadReceipts,
	stashCatchUpRead,
	stashReadReceipt,
} from "../pendingMessageReadReceipts";

const mk = (overrides: Partial<Message> = {}): Message =>
	({
		id: "m1",
		chatRoomId: "r1",
		createdAt: "2026-09-02T17:41:00.000Z",
		content: "hello",
		senderId: "dispatcher",
		isRead: false,
		readBy: ["dispatcher"],
		sender: { id: "dispatcher", firstName: "A", lastName: "B" },
		...overrides,
	}) as Message;

describe("pendingMessageReadReceipts", () => {
	beforeEach(() => {
		resetPendingMessageReadReceipts();
	});

	it("applies a stashed receipt when the message later appears", () => {
		stashReadReceipt("m1", "driver");
		const updated = applyPendingReadsToMessage(mk());
		expect(updated.isRead).toBe(true);
		expect(updated.readBy).toEqual(expect.arrayContaining(["dispatcher", "driver"]));
	});

	it("consumes a per-message receipt so it is not applied twice", () => {
		stashReadReceipt("m1", "driver");
		applyPendingReadsToMessage(mk());
		const second = applyPendingReadsToMessage(mk({ isRead: false, readBy: ["dispatcher"] }));
		expect(second.isRead).toBe(false);
		expect(second.readBy).toEqual(["dispatcher"]);
	});

	it("applies catch-up to earlier messages but not later ones", () => {
		stashCatchUpRead("r1", "driver", "2026-09-02T17:41:00.000Z");
		const earlier = applyPendingReadsToMessage(mk(), { applyCatchUp: true });
		const later = applyPendingReadsToMessage(
			mk({
				id: "m2",
				createdAt: "2026-09-02T17:42:00.000Z",
			}),
			{ applyCatchUp: true }
		);
		expect(earlier.isRead).toBe(true);
		expect(later.isRead).toBe(false);
	});

	it("does not mark the sender's own messages via catch-up", () => {
		stashCatchUpRead("r1", "driver", "2026-09-02T17:41:00.000Z");
		const own = applyPendingReadsToMessage(
			mk({ senderId: "driver", readBy: ["driver"] }),
			{ applyCatchUp: true }
		);
		expect(own.isRead).toBe(false);
	});

	it("hydrates a list from stashed receipts", () => {
		stashReadReceipt("m1", "driver");
		stashReadReceipt("m3", "driver");
		const [first, second] = applyPendingReadsToMessages([
			mk(),
			mk({ id: "m2", isRead: false, readBy: ["dispatcher"] }),
		]);
		expect(first.isRead).toBe(true);
		expect(second.isRead).toBe(false);
	});
});
