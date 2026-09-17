"use client";

import React from "react";
import type { ChatMentionCandidate } from "@/utils/chatMentions";
import { renderAvatar } from "@/helpers";

type ChatMentionPickerProps = {
	candidates: ChatMentionCandidate[];
	selectedIndex: number;
	onSelect: (candidate: ChatMentionCandidate) => void;
	onHoverIndex: (index: number) => void;
	style: React.CSSProperties;
};

export default function ChatMentionPicker({
	candidates,
	selectedIndex,
	onSelect,
	onHoverIndex,
	style,
}: ChatMentionPickerProps) {
	if (candidates.length === 0) return null;

	return (
		<div
			className="z-[10040] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
			style={style}
			role="listbox"
			aria-label="Mention a participant"
		>
			{candidates.map((candidate, index) => {
				const isSelected = index === selectedIndex;
				return (
					<button
						key={candidate.id}
						type="button"
						role="option"
						aria-selected={isSelected}
						className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left ${
							isSelected
								? "bg-brand-50 dark:bg-white/10"
								: "hover:bg-gray-50 dark:hover:bg-white/5"
						}`}
						onMouseDown={event => {
							event.preventDefault();
							onSelect(candidate);
						}}
						onMouseEnter={() => onHoverIndex(index)}
					>
						{renderAvatar(
							{
								firstName: candidate.firstName,
								lastName: candidate.lastName,
								profilePhoto: candidate.profilePhoto || candidate.avatar,
								userColor: candidate.userColor,
								role: candidate.role,
							},
							"w-8 h-8"
						)}
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-gray-900 dark:text-white">
								{candidate.name}
							</p>
							<p className="truncate text-xs text-brand-600 dark:text-brand-400">
								@{candidate.name}
							</p>
						</div>
					</button>
				);
			})}
		</div>
	);
}
