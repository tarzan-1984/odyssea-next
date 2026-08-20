import { Message } from "@/app-api/chatApi";
import {
	estimateChatMessageHeight,
	visibleChatMessageText,
} from "@/utils/estimateChatMessageHeight";

function message(content: string, extra?: Partial<Message>): Message {
	return {
		id: "m1",
		chatRoomId: "c1",
		senderId: "u1",
		content,
		isRead: true,
		createdAt: "2026-01-01T00:00:00Z",
		sender: {
			id: "u1",
			firstName: "Natali",
			lastName: "A",
			role: "DISPATCHER",
		} as Message["sender"],
		...extra,
	};
}

describe("visibleChatMessageText", () => {
	it("turns HTML line breaks into newlines", () => {
		expect(visibleChatMessageText("A<br>B<br/>C")).toBe("A\nB\nC");
	});

	it("strips tags from HTML emails", () => {
		expect(visibleChatMessageText("<p>Rate Adjustment</p><p>MC# 1287254</p>")).toBe(
			"Rate Adjustment\nMC# 1287254"
		);
	});
});

describe("estimateChatMessageHeight", () => {
	it("estimates HTML emails taller than a single plain line", () => {
		const html = message(
			"<p>Rate Adjustment for Late Service</p><br><br><p>MC# 1287254</p><br><p>DOT# 3690406</p>"
		);
		const plain = message("Rate Adjustment for Late Service");
		expect(estimateChatMessageHeight(html)).toBeGreaterThan(estimateChatMessageHeight(plain) + 40);
	});

	it("does not treat a whole HTML email as one line", () => {
		const html = message(
			Array.from({ length: 12 }, (_, i) => `<p>Line ${i + 1} of the notice</p>`).join("")
		);
		expect(estimateChatMessageHeight(html)).toBeGreaterThan(200);
	});
});
