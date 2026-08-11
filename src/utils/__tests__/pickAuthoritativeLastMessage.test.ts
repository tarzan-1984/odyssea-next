import { pickAuthoritativeLastMessage } from "../pickAuthoritativeLastMessage";

describe("pickAuthoritativeLastMessage", () => {
	const mk = (
		id: string,
		createdAt: string,
		extra?: { pendingOutgoing?: { clientMessageId: string; status: string } }
	) => ({ id, createdAt, content: id, ...extra });

	it("prefers API when store has a newer ghost preview", () => {
		const api = mk("a", "2026-01-01T10:00:00Z");
		const store = mk("ghost", "2026-01-01T11:00:00Z");
		expect(pickAuthoritativeLastMessage(api, store)?.id).toBe("a");
	});

	it("clears ghost when API returns null", () => {
		const store = mk("ghost", "2026-01-01T11:00:00Z");
		expect(pickAuthoritativeLastMessage(null, store)).toBeNull();
	});

	it("keeps pending outgoing over older API lastMessage", () => {
		const api = mk("a", "2026-01-01T10:00:00Z");
		const store = mk("opt", "2026-01-01T11:00:00Z", {
			pendingOutgoing: { clientMessageId: "c1", status: "sending" },
		});
		expect(pickAuthoritativeLastMessage(api, store)?.id).toBe("opt");
	});

	it("with preferNewerStore keeps newer store over cache", () => {
		const cache = mk("a", "2026-01-01T10:00:00Z");
		const store = mk("b", "2026-01-01T11:00:00Z");
		expect(
			pickAuthoritativeLastMessage(cache, store, { preferNewerStore: true })?.id
		).toBe("b");
	});
});
