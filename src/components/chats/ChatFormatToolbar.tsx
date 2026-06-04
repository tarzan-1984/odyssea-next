"use client";

import React from "react";
import { Bold, Italic, Underline, Strikethrough } from "lucide-react";
import type { MarkdownWrapKind } from "@/utils/chatMarkdown";
import type { EditorFormatState } from "@/utils/chatRichEditor";

export type ChatFormatAction = { type: "wrap"; kind: MarkdownWrapKind };

type ChatFormatToolbarProps = {
	disabled?: boolean;
	activeFormats: EditorFormatState;
	onAction: (action: ChatFormatAction) => void;
};

function ToolbarButton({
	label,
	disabled,
	active,
	onClick,
	children,
}: {
	label: string;
	disabled?: boolean;
	active?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			aria-label={label}
			aria-pressed={active}
			title={label}
			className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 ${
				active
					? "bg-brand-500/15 text-brand-600 dark:bg-brand-500/25 dark:text-brand-400"
					: "text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white/90"
			}`}
		>
			{children}
		</button>
	);
}

export default function ChatFormatToolbar({
	disabled,
	activeFormats,
	onAction,
}: ChatFormatToolbarProps) {
	return (
		<div
			className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-2 py-1 dark:border-gray-700"
			onMouseDown={e => e.preventDefault()}
		>
			<ToolbarButton
				label="Bold"
				disabled={disabled}
				active={activeFormats.bold}
				onClick={() => onAction({ type: "wrap", kind: "bold" })}
			>
				<Bold className="h-4 w-4" aria-hidden />
			</ToolbarButton>
			<ToolbarButton
				label="Italic"
				disabled={disabled}
				active={activeFormats.italic}
				onClick={() => onAction({ type: "wrap", kind: "italic" })}
			>
				<Italic className="h-4 w-4" aria-hidden />
			</ToolbarButton>
			<ToolbarButton
				label="Underline"
				disabled={disabled}
				active={activeFormats.underline}
				onClick={() => onAction({ type: "wrap", kind: "underline" })}
			>
				<Underline className="h-4 w-4" aria-hidden />
			</ToolbarButton>
			<ToolbarButton
				label="Strikethrough"
				disabled={disabled}
				active={activeFormats.strikeThrough}
				onClick={() => onAction({ type: "wrap", kind: "strike" })}
			>
				<Strikethrough className="h-4 w-4" aria-hidden />
			</ToolbarButton>
		</div>
	);
}
