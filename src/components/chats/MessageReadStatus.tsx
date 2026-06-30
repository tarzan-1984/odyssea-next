"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChatRoomParticipant } from "@/app-api/chatApi";
import { resolveChatUserDisplayName } from "@/utils/resolveChatUserName";

interface MessageReadStatusProps {
	isRead: boolean;
	/** User ids who read the message (from DB `readBy`). */
	readBy?: string[];
	/** Room participants — used to resolve names for ids in `readBy`. */
	participants?: ChatRoomParticipant[];
	/** Pre-built lookup from participants + loaded messages. */
	userNameLookup?: Map<string, string>;
	currentUserId?: string | null;
	/** Message author — excluded from the list (sender is always in `readBy` on send). */
	senderId?: string;
	className?: string;
}

export default function MessageReadStatus({
	isRead,
	readBy = [],
	participants = [],
	userNameLookup,
	currentUserId,
	senderId,
	className = "",
}: MessageReadStatusProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	const readers = useMemo(() => {
		const ids = [...new Set(readBy)]
			.filter(Boolean)
			.filter(id => !(senderId && id === senderId));

		return ids
			.map(id => ({
				id,
				label: resolveChatUserDisplayName(id, {
					currentUserId,
					participants,
					nameLookup: userNameLookup,
				}),
			}))
			.filter((reader): reader is { id: string; label: string } => Boolean(reader.label));
	}, [readBy, participants, userNameLookup, currentUserId, senderId]);

	const canOpenDetails = isRead && readers.length > 0;

	useEffect(() => {
		if (!open) return;
		const onDocDown = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onDocDown);
		return () => document.removeEventListener("mousedown", onDocDown);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	const readIcon = (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="text-blue-500"
		>
			<path
				d="M1.5 12.5L5.57574 16.5757C5.81005 16.8101 6.18995 16.8101 6.42426 16.5757L9 14"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<path d="M16 7L12 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
			<path
				d="M7 12L11.5757 16.5757C11.8101 16.8101 12.1899 16.8101 12.4243 16.5757L22 7"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
		</svg>
	);

	const sentIcon = (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="text-gray-500"
		>
			<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
		</svg>
	);

	return (
		<div ref={containerRef} className={`relative inline-flex shrink-0 ${className}`}>
			{canOpenDetails ? (
				<button
					type="button"
					onClick={() => setOpen(v => !v)}
					className="inline-flex items-center justify-center rounded p-0.5 text-blue-500 hover:bg-blue-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
					aria-label="Who read this message"
					aria-expanded={open}
					aria-haspopup="true"
				>
					{readIcon}
				</button>
			) : (
				<div className="inline-flex items-center justify-center" aria-hidden={!isRead}>
					{isRead ? readIcon : sentIcon}
				</div>
			)}

			{open && canOpenDetails ? (
				<div
					role="tooltip"
					className="absolute bottom-full right-0 z-[200] mb-1 flex max-h-[min(13.5rem,42vh)] w-max max-w-[min(18rem,calc(100vw-2rem))] flex-col rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-2 text-left shadow-lg dark:border-gray-600 dark:bg-gray-800"
				>
					<p className="mb-1 shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
						Read by
					</p>
					<ul className="custom-scrollbar max-h-[10rem] min-h-0 space-y-1 overflow-y-auto overflow-x-hidden pr-1 text-xs text-gray-800 dark:text-gray-100 sm:max-h-[11rem]">
						{readers.map(r => (
							<li key={r.id} className="whitespace-normal break-words leading-snug">
								{r.label}
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}
