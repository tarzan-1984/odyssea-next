import { escapeChatListSyntax, stripMarkdown } from "@/utils/chatMarkdown";

describe("escapeChatListSyntax", () => {
	it("preserves phone-like ordered markers", () => {
		expect(escapeChatListSyntax("215) 380-9284 Kevin T. POC")).toBe(
			"215\\) 380-9284 Kevin T. POC"
		);
	});

	it("preserves parenthesized area codes", () => {
		expect(escapeChatListSyntax("(215) 380-9284")).toBe("(215) 380-9284");
	});

	it("escapes bullet list markers at line start", () => {
		expect(escapeChatListSyntax("- item")).toBe("\\- item");
		expect(escapeChatListSyntax("* item")).toBe("\\* item");
	});

	it("does not escape mid-line markers", () => {
		expect(escapeChatListSyntax("a - b")).toBe("a - b");
	});

	it("does not escape italic syntax", () => {
		expect(escapeChatListSyntax("*italic*")).toBe("*italic*");
	});
});

describe("stripMarkdown", () => {
	it("strips ordered markers with dot or paren", () => {
		expect(stripMarkdown("215) hello")).toBe("hello");
		expect(stripMarkdown("1. hello")).toBe("hello");
	});
});
