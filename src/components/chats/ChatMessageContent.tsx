"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

const chatMarkdownSanitizeSchema: Schema = {
	...defaultSchema,
	tagNames: ["p", "br", "strong", "em", "del", "u", "ul", "ol", "li"],
};

type ChatMessageContentProps = {
	content: string;
	className?: string;
};

export default function ChatMessageContent({ content, className = "" }: ChatMessageContentProps) {
	if (!content.trim()) {
		return null;
	}

	return (
		<div className={`chat-markdown min-w-0 break-words ${className}`.trim()}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={[rehypeRaw, [rehypeSanitize, { schema: chatMarkdownSanitizeSchema }]]}
				components={{
					p: ({ children }) => (
						<p className="chat-msg-body mb-1 last:mb-0 whitespace-pre-wrap">{children}</p>
					),
					ul: ({ children }) => (
						<ul className="chat-msg-body my-1 list-disc space-y-0.5 pl-5">{children}</ul>
					),
					ol: ({ children }) => (
						<ol className="chat-msg-body my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
					),
					li: ({ children }) => <li className="chat-msg-body">{children}</li>,
					strong: ({ children }) => <strong className="font-bold">{children}</strong>,
					em: ({ children }) => <em className="italic">{children}</em>,
					del: ({ children }) => <del className="line-through opacity-90">{children}</del>,
					u: ({ children }) => <u className="underline">{children}</u>,
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
