"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import { isAllowedChatHref, preprocessChatMessageLinks } from "@/utils/chatLinks";

const chatMarkdownSanitizeSchema: Schema = {
	...defaultSchema,
	tagNames: ["p", "br", "strong", "em", "del", "u", "ul", "ol", "li", "a"],
	attributes: {
		...defaultSchema.attributes,
		a: [
			...(Array.isArray(defaultSchema.attributes?.a) ? defaultSchema.attributes.a : []),
			"href",
			"target",
			"rel",
		],
	},
};

type ChatMessageContentProps = {
	content: string;
	className?: string;
	/** Outgoing bubble (blue bg) — links are white. */
	isOutgoing?: boolean;
};

export default function ChatMessageContent({
	content,
	className = "",
	isOutgoing = false,
}: ChatMessageContentProps) {
	if (!content.trim()) {
		return null;
	}

	const linkedContent = preprocessChatMessageLinks(content);

	const rootClass = [
		"chat-markdown min-w-0 break-words",
		isOutgoing ? "chat-markdown--outgoing" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={rootClass}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={[
					rehypeRaw,
					[rehypeSanitize, { schema: chatMarkdownSanitizeSchema }],
				]}
				components={{
					a: ({ href, children }) => {
						if (!href || !isAllowedChatHref(href)) {
							return <span>{children}</span>;
						}
						return (
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className={
									isOutgoing
										? "break-all underline underline-offset-2 !text-white hover:!text-white/90"
										: "chat-msg-link break-all"
								}
							>
								{children}
							</a>
						);
					},
					p: ({ children }) => <p className="chat-msg-body mb-2 last:mb-0">{children}</p>,
					ul: ({ children }) => (
						<ul className="chat-msg-body my-1 list-disc space-y-0.5 pl-5">
							{children}
						</ul>
					),
					ol: ({ children }) => (
						<ol className="chat-msg-body my-1 list-decimal space-y-0.5 pl-5">
							{children}
						</ol>
					),
					li: ({ children }) => <li className="chat-msg-body">{children}</li>,
					strong: ({ children }) => <strong className="font-bold">{children}</strong>,
					em: ({ children }) => <em className="italic">{children}</em>,
					del: ({ children }) => (
						<del className="line-through opacity-90">{children}</del>
					),
					u: ({ children }) => <u className="underline">{children}</u>,
				}}
			>
				{linkedContent}
			</ReactMarkdown>
		</div>
	);
}
