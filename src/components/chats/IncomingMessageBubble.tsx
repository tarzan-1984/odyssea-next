"use client";

import React from "react";
import { Message } from "@/app-api/chatApi";
import MessageReactionTrigger from "./MessageReactionTrigger";

interface IncomingMessageBubbleProps {
	message: Message;
	currentUserId?: string | null;
	className?: string;
	children: React.ReactNode;
}

/** Wraps incoming bubble content; reaction button shows on bubble hover only. */
export default function IncomingMessageBubble({
	message,
	currentUserId,
	className = "",
	children,
}: IncomingMessageBubbleProps) {
	return (
		<div
			className={`group/bubble relative w-fit max-w-full ${className}`.trim()}
		>
			{children}
			<MessageReactionTrigger message={message} currentUserId={currentUserId} />
		</div>
	);
}
