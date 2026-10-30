import { stripMarkdown } from "@/utils/chatMarkdown";

type ReplyLike = {
	content?: string;
	fileName?: string;
	fileUrl?: string;
} | null | undefined;

/** Text shown in a quote when the original message is a file or has no caption. */
export function replyQuoteText(replyData: ReplyLike): string {
	const plain = stripMarkdown(replyData?.content || "").replace(/\s+/g, " ").trim();
	if (plain) return plain.length > 100 ? `${plain.slice(0, 100)}...` : plain;
	const names = (replyData?.fileName || "")
		.split("|")
		.map(part => part.trim())
		.filter(Boolean);
	if (names.length > 1) return `${names.length} files`;
	if (names[0]) return names[0];
	if (replyData?.fileUrl) return "Attachment";
	return "";
}
