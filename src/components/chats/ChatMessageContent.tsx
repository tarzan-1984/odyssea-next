"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import { BidChatActionIcon } from "@/icons";
import { isAllowedChatHref, preprocessChatMessageLinks } from "@/utils/chatLinks";
import { escapeChatListSyntax } from "@/utils/chatMarkdown";
import { isBidPlusOneMessage } from "@/utils/bidPlusOneMessage";
import {
	formatBidPriceUpdateMarkdown,
	isBidPriceUpdateMessage,
} from "@/utils/bidPriceUpdateMessage";
import BidPlusOneTimer from "./BidPlusOneTimer";

const chatMarkdownSanitizeSchema: Schema = {
	...defaultSchema,
	tagNames: ["p", "br", "strong", "em", "del", "u", "a"],
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
	/** Sender of this message (needed for BID +1 timer). */
	senderUserId?: string;
	/** Whether current user can extend this +1 timer. */
	canManageBidTimer?: boolean;
	/** Only the newest +1 from this sender shows a live timer. */
	isLatestBidPlusOne?: boolean;
};

export default function ChatMessageContent({
	content,
	className = "",
	isOutgoing = false,
	senderUserId,
	canManageBidTimer = false,
	isLatestBidPlusOne = true,
}: ChatMessageContentProps) {
	if (!content.trim()) {
		return null;
	}

	if (isBidPlusOneMessage(content)) {
		return (
			<div
				className={`flex flex-col items-center justify-center py-1 ${className}`}
				aria-label="+1"
			>
				<BidChatActionIcon className="h-10 w-10 text-green-400 dark:text-green-300" />
				{senderUserId ? (
					<BidPlusOneTimer
						senderUserId={senderUserId}
						canManage={canManageBidTimer}
						isOutgoing={isOutgoing}
						isLatestPlusOneMessage={isLatestBidPlusOne}
					/>
				) : null}
			</div>
		);
	}

	const isBidPriceUpdate = isBidPriceUpdateMessage(content);
	const renderContent = escapeChatListSyntax(
		preprocessChatMessageLinks(
			isBidPriceUpdate ? formatBidPriceUpdateMarkdown(content) : content,
		),
	);

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
					p: ({ children }) => <p className="chat-msg-body mb-0">{children}</p>,
					strong: ({ children }) => (
						<strong
							className={
								isBidPriceUpdate
									? "font-bold text-blue-600 dark:text-blue-600"
									: "font-bold"
							}
						>
							{children}
						</strong>
					),
					em: ({ children }) => <em className="italic">{children}</em>,
					del: ({ children }) => (
						<del className="line-through opacity-90">{children}</del>
					),
					u: ({ children }) => <u className="underline">{children}</u>,
				}}
			>
				{renderContent}
			</ReactMarkdown>
		</div>
	);
}
