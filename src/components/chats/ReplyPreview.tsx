import React from 'react';
import { Message } from '@/app-api/chatApi';

interface ReplyPreviewProps {
	replyData: Message['replyData'];
	onCancel: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ replyData, onCancel }) => {
	if (!replyData) return null;

	const formatTime = (timeString: string) => {
		const date = new Date(timeString);
		return date.toLocaleTimeString('en-US', { 
			hour: '2-digit', 
			minute: '2-digit',
			hour12: true 
		});
	};

	return (
		<div className="reply-preview">
			<div className="reply-preview-content">
				<div className="reply-preview-header">
					<span className="reply-preview-label">Replying to</span>
					<span className="reply-preview-sender">{replyData.senderName}</span>
					<span className="reply-preview-time">{formatTime(replyData.time)}</span>
				</div>
				<div className="reply-preview-message">
					{replyData.content.length > 100 
						? `${replyData.content.substring(0, 100)}...` 
						: replyData.content
					}
				</div>
			</div>
			<button 
				className="reply-preview-cancel"
				onClick={onCancel}
				aria-label="Cancel reply"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	);
};

export default ReplyPreview;
