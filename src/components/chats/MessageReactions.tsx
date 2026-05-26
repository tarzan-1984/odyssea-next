"use client";

import React, { useCallback, useState } from "react";
import {
	chatApi,
	Message,
	MessageReactionGroup,
} from "@/app-api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import { renderAvatar, resolveAvatarBackground } from "@/helpers";

export { QUICK_REACTIONS } from "./messageReactionConstants";

interface MessageReactionsProps {
	message: Message;
	currentUserId?: string | null;
	/** Show hover trigger and picker (incoming messages). */
	canReact?: boolean;
	align?: "left" | "right";
}

function ReactionAvatars({ users }: { users: MessageReactionGroup["users"] }) {
	const visible = users.slice(0, 3);
	const extra = users.length - visible.length;

	return (
		<span className="flex -space-x-1.5">
			{visible.map(user => (
				<span
					key={user.id}
					className="relative inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full ring-1 ring-white dark:ring-gray-900"
					style={{
						backgroundColor: resolveAvatarBackground(
							user.role,
							user.userColor ?? null,
						),
					}}
					title={`${user.firstName} ${user.lastName}`.trim()}
				>
					{renderAvatar(
						{
							avatar: user.avatar,
							firstName: user.firstName,
							lastName: user.lastName,
							role: user.role,
							userColor: user.userColor ?? null,
						},
						"h-4 w-4 text-[8px]",
						{ parentProvidesBackground: true },
					)}
				</span>
			))}
			{extra > 0 ? (
				<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-200 px-0.5 text-[9px] font-medium text-gray-600 ring-1 ring-white dark:bg-gray-600 dark:text-gray-200 dark:ring-gray-900">
					+{extra}
				</span>
			) : null}
		</span>
	);
}

const chipClassName = (isActive: boolean, interactive: boolean) =>
	`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${
		isActive
			? "border-brand-300 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/20"
			: interactive
				? "border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
				: "border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800"
	}`;

export function MessageReactionsBar({
	reactions,
	onChipClick,
	align = "left",
	interactive = true,
}: {
	reactions: MessageReactionGroup[];
	onChipClick?: (group: MessageReactionGroup) => void;
	align?: "left" | "right";
	/** When false, chips are display-only (outgoing messages). */
	interactive?: boolean;
}) {
	if (!reactions.length) return null;

	return (
		<div
			className={`mt-1 flex flex-wrap gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}
		>
			{reactions.map(group => {
				const isActive = group.hasCurrentUser;
				const title = group.users
					.map(u => `${u.firstName} ${u.lastName}`.trim())
					.join(", ");
				const content = (
					<>
						<span className="text-sm leading-none">{group.emoji}</span>
						<ReactionAvatars users={group.users} />
					</>
				);

				if (!interactive) {
					return (
						<span
							key={group.emoji}
							className={chipClassName(isActive, false)}
							title={title}
						>
							{content}
						</span>
					);
				}

				return (
					<button
						key={group.emoji}
						type="button"
						onClick={() => onChipClick?.(group)}
						className={chipClassName(isActive, true)}
						title={title}
					>
						{content}
					</button>
				);
			})}
		</div>
	);
}

export default function MessageReactions({
	message,
	currentUserId,
	canReact = false,
	align = "left",
}: MessageReactionsProps) {
	const updateMessage = useChatStore(s => s.updateMessage);
	const [busy, setBusy] = useState(false);

	const reactions = message.reactions ?? [];

	const applyReactions = useCallback(
		(next: MessageReactionGroup[]) => {
			updateMessage(message.id, { reactions: next });
		},
		[message.id, updateMessage],
	);

	const handleChipClick = useCallback(
		async (group: MessageReactionGroup) => {
			if (!canReact || busy || !currentUserId) return;
			setBusy(true);
			try {
				if (group.hasCurrentUser) {
					const result = await chatApi.removeMessageReaction(message.id);
					applyReactions(result.reactions);
				} else {
					const result = await chatApi.setMessageReaction(message.id, group.emoji);
					applyReactions(result.reactions);
				}
			} catch (error) {
				console.error("Failed to toggle reaction:", error);
			} finally {
				setBusy(false);
			}
		},
		[applyReactions, busy, canReact, currentUserId, message.id],
	);

	const showBar = reactions.length > 0;

	if (!showBar) return null;

	return (
		<MessageReactionsBar
			reactions={reactions}
			interactive={canReact}
			onChipClick={group => {
				handleChipClick(group).catch(() => {});
			}}
			align={align}
		/>
	);
}
