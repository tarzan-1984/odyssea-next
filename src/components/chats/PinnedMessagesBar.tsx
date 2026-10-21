"use client";

import { Message } from "@/app-api/chatApi";
import { stripMarkdown } from "@/utils/chatMarkdown";

export function pinnedMessagePreview(message: Message): string {
	const text = stripMarkdown(message.content || "")
		.replace(/\s+/g, " ")
		.trim();
	if (text) return text;
	const fileName = message.fileName?.split("|")[0]?.trim();
	if (fileName) return fileName;
	return "Attachment";
}

function PinIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 122.879 122.867"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M83.88,0.451L122.427,39c0.603,0.601,0.603,1.585,0,2.188l-13.128,13.125c-0.602,0.604-1.586,0.604-2.187,0l-3.732-3.73l-17.303,17.3c3.882,14.621,0.095,30.857-11.37,42.32c-0.266,0.268-0.535,0.529-0.808,0.787c-1.004,0.955-0.843,0.949-1.813-0.021L47.597,86.48L0,122.867l36.399-47.584L11.874,50.76c-0.978-0.98-0.896-0.826,0.066-1.837c0.24-0.251,0.485-0.503,0.734-0.753C24.137,36.707,40.376,32.917,54.996,36.8l17.301-17.3l-3.733-3.732c-0.601-0.601-0.601-1.585,0-2.188L81.691,0.451C82.295-0.15,83.279-0.15,83.88,0.451z"
			/>
		</svg>
	);
}

interface PinnedMessagesBarProps {
	messages: Message[];
	activeIndex: number;
	canUnpin?: boolean;
	onClick: () => void;
	onUnpin: (message: Message) => void;
}

export default function PinnedMessagesBar({
	messages,
	activeIndex,
	canUnpin = false,
	onClick,
	onUnpin,
}: PinnedMessagesBarProps) {
	if (messages.length === 0) return null;

	const index = ((activeIndex % messages.length) + messages.length) % messages.length;
	const message = messages[index];
	if (!message) return null;

	const senderName = `${message.sender?.firstName ?? ""} ${message.sender?.lastName ?? ""}`.trim();
	const marks = Math.min(messages.length, 3);
	const activeMark = index % marks;

	return (
		<div className="flex w-full items-stretch gap-2 border-b border-gray-200 bg-white px-5 py-2 dark:border-gray-800 dark:bg-transparent xl:px-6">
			<button
				type="button"
				onClick={onClick}
				className="flex min-w-0 flex-1 items-stretch gap-3 text-left hover:opacity-80"
			>
				<span className="flex w-1 shrink-0 flex-col gap-0.5 py-0.5" aria-hidden>
					{Array.from({ length: marks }, (_, mark) => (
						<span
							key={mark}
							className={`w-1 flex-1 rounded-full ${
								mark === activeMark ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
							}`}
						/>
					))}
				</span>
				<span className="min-w-0 flex-1">
					<span className="block truncate text-xs font-medium text-brand-500">
						{senderName || "Pinned message"}
					</span>
					<span className="block truncate text-sm text-gray-800 dark:text-white/90">
						{pinnedMessagePreview(message)}
					</span>
				</span>
			</button>
			{canUnpin ? (
				<button
					type="button"
					aria-label="Unpin message"
					title="Unpin"
					onClick={() => onUnpin(message)}
					className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
				>
					<PinIcon />
				</button>
			) : null}
		</div>
	);
}
