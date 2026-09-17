"use client";

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import type { Schema } from "hast-util-sanitize";
import { BidChatActionIcon } from "@/icons";
import { isAllowedChatHref, preprocessChatMessageLinks } from "@/utils/chatLinks";
import { escapeChatListSyntax } from "@/utils/chatMarkdown";
import { isBidPlusOneMessage } from "@/utils/bidPlusOneMessage";
import {
	formatBidPriceUpdateMarkdown,
	isBidPriceUpdateMessage,
} from "@/utils/bidPriceUpdateMessage";
import { wrapChatMentionsInMarkdown } from "@/utils/chatMentions";
import BidPlusOneTimer from "./BidPlusOneTimer";

const chatMarkdownSanitizeSchema: Schema = {
	...defaultSchema,
	tagNames: ["p", "br", "strong", "em", "del", "u", "a", "span"],
	attributes: {
		...defaultSchema.attributes,
		a: [
			...(Array.isArray(defaultSchema.attributes?.a) ? defaultSchema.attributes.a : []),
			"href",
			"target",
			"rel",
		],
		span: [
			...(Array.isArray(defaultSchema.attributes?.span) ? defaultSchema.attributes.span : []),
			"className",
			"class",
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
	/** Participant names used to highlight @mentions. */
	mentionNames?: string[];
};

function MarkdownParagraph({ children }: { children?: React.ReactNode }) {
	return (
		<>
			{children}
			<br data-chat-md-gap="" />
			<br data-chat-md-gap="" />
		</>
	);
}

function MarkdownEm({ children }: { children?: React.ReactNode }) {
	return <em className="italic">{children}</em>;
}

function MarkdownDel({ children }: { children?: React.ReactNode }) {
	return <del className="line-through opacity-90">{children}</del>;
}

function MarkdownUnderline({ children }: { children?: React.ReactNode }) {
	return <u className="underline">{children}</u>;
}

function ChatMessageContent({
	content,
	className = "",
	isOutgoing = false,
	senderUserId,
	canManageBidTimer = false,
	isLatestBidPlusOne = true,
	mentionNames = [],
}: ChatMessageContentProps) {
	const isBidPriceUpdate = isBidPriceUpdateMessage(content);
	const markdownComponents = useMemo<Components>(
		() => ({
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
			p: MarkdownParagraph,
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
			em: MarkdownEm,
			del: MarkdownDel,
			u: MarkdownUnderline,
			span: ({ className, children }) => {
				if (className === "chat-mention") {
					return <span className="chat-mention">{children}</span>;
				}
				return <span className={className}>{children}</span>;
			},
		}),
		[isBidPriceUpdate, isOutgoing],
	);

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

	const renderContent = wrapChatMentionsInMarkdown(
		escapeChatListSyntax(
			preprocessChatMessageLinks(
				isBidPriceUpdate ? formatBidPriceUpdateMarkdown(content) : content,
			),
		),
		mentionNames,
	);

	const rootClass = [
		"chat-markdown chat-msg-body min-w-0 break-words",
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
				components={markdownComponents}
			>
				{renderContent}
			</ReactMarkdown>
		</div>
	);
}

export default React.memo(ChatMessageContent);
