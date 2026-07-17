"use client";

import React from "react";
import { Message } from "@/app-api/chatApi";
import MessageReactionTrigger from "./MessageReactionTrigger";

interface IncomingMessageBubbleProps {
	message: Message;
	currentUserId?: string | null;
	className?: string;
	/** When false, hide reaction button (e.g. BID chats). */
	allowReactions?: boolean;
	children: React.ReactNode;
}

/** Wraps incoming bubble content; reaction button shows on bubble hover only. */
export default function IncomingMessageBubble({
	message,
	currentUserId,
	className = "",
	allowReactions = true,
	children,
}: IncomingMessageBubbleProps) {
	return (
		<div
			className={`group/bubble relative w-fit max-w-full ${className}`.trim()}
		>
			{children}
			{allowReactions ? (
				<MessageReactionTrigger message={message} currentUserId={currentUserId} />
			) : null}
		</div>
	);
}
