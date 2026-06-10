import React from "react";
import { Message } from "@/app-api/chatApi";
import { stripMarkdown } from "@/utils/chatMarkdown";
import { formatNyWallClockDateTime } from "@/utils/nyWallClock";

interface MessageReplyProps {
	replyData: Message['replyData'];
}

const MessageReply: React.FC<MessageReplyProps> = ({ replyData }) => {
	if (!replyData) return null;

	return (
		<div className="message-reply">
			<div className="message-reply-header">
				<span className="message-reply-label">Reply to</span>
				<span className="message-reply-sender">{replyData.senderName}</span>
				<span className="message-reply-time">{formatNyWallClockDateTime(replyData.time)}</span>
			</div>
			<div className="message-reply-content">
				{(() => {
					const plain = stripMarkdown(replyData.content);
					return plain.length > 100 ? `${plain.substring(0, 100)}...` : plain;
				})()}
			</div>
		</div>
	);
};

export default MessageReply;
