import {
	buildMentionCandidates,
	canStartMentionAt,
	filterMentionCandidates,
	findMentionMatches,
	findMentionQueryAtCaret,
	splitTextByMentions,
	wrapChatMentionsInMarkdown,
} from "@/utils/chatMentions";

describe("canStartMentionAt", () => {
	it("allows @ at the start of text", () => {
		expect(canStartMentionAt("@John", 0)).toBe(true);
	});

	it("allows @ after whitespace", () => {
		expect(canStartMentionAt("hi @John", 3)).toBe(true);
	});

	it("does not treat email @ as a mention", () => {
		expect(canStartMentionAt("user@mail.com", 4)).toBe(false);
	});
});

describe("findMentionMatches", () => {
	const names = ["John Smith", "Anna"];

	it("matches a full name after @", () => {
		expect(findMentionMatches("hello @John Smith!", names)).toEqual([
			{ start: 6, end: 17, name: "John Smith" },
		]);
	});

	it("matches the longest name first", () => {
		expect(findMentionMatches("@John Smith", ["John", "John Smith"])).toEqual([
			{ start: 0, end: 11, name: "John Smith" },
		]);
	});

	it("does not match an incomplete name", () => {
		expect(findMentionMatches("@John Smi", names)).toEqual([]);
	});

	it("is case-insensitive", () => {
		expect(findMentionMatches("@john smith", names)).toEqual([
			{ start: 0, end: 11, name: "john smith" },
		]);
	});
});

describe("findMentionQueryAtCaret", () => {
	it("reads the query after @", () => {
		expect(findMentionQueryAtCaret("hi @Jo", 6, ["John Smith"])).toEqual({
			start: 3,
			query: "Jo",
		});
	});

	it("closes the query after a complete mention", () => {
		expect(findMentionQueryAtCaret("@Anna ", 6, ["Anna"])).toBeNull();
	});

	it("does not cross a newline", () => {
		expect(findMentionQueryAtCaret("hi\n@Jo", 6)).toEqual({ start: 3, query: "Jo" });
	});
});

describe("filterMentionCandidates", () => {
	const candidates = buildMentionCandidates([
		{ user: { id: "1", firstName: "John", lastName: "Smith" } },
		{ user: { id: "2", firstName: "Anna", lastName: "Lee" } },
		{ hideParticipant: true, user: { id: "3", firstName: "Hidden", lastName: "User" } },
	]);

	it("skips hidden participants", () => {
		expect(candidates.map(item => item.name)).toEqual(["Anna Lee", "John Smith"]);
	});

	it("filters by first name prefix", () => {
		expect(filterMentionCandidates(candidates, "jo").map(item => item.name)).toEqual([
			"John Smith",
		]);
	});

	it("filters by last name prefix", () => {
		expect(filterMentionCandidates(candidates, "sm").map(item => item.name)).toEqual([
			"John Smith",
		]);
	});
});

describe("wrapChatMentionsInMarkdown", () => {
	it("wraps a complete mention", () => {
		expect(wrapChatMentionsInMarkdown("hi @Anna", ["Anna"])).toBe(
			'hi <span class="chat-mention">@Anna</span>'
		);
	});

	it("does not wrap mentions inside markdown links", () => {
		expect(wrapChatMentionsInMarkdown("[@Anna](https://example.com)", ["Anna"])).toBe(
			"[@Anna](https://example.com)"
		);
	});
});

describe("splitTextByMentions", () => {
	it("splits mention tokens from surrounding text", () => {
		expect(splitTextByMentions("see @Anna now", ["Anna"])).toEqual([
			{ text: "see ", mention: false },
			{ text: "@Anna", mention: true },
			{ text: " now", mention: false },
		]);
	});
});
