"use client";

import { useEffect, useState, FormEvent, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import type { CheckListDriver } from "./checkListTypes";
import {
	bulkCreatePrivateChatsWithMessage,
	normalizeBulkDirectChatRoom,
	showBulkPrivateChatsToast,
} from "./checkListBulkPrivateChats";
import { useChatStore } from "@/stores/chatStore";
import { indexedDBChatService } from "@/services/IndexedDBChatService";

type CheckListChatModalProps = {
	isOpen: boolean;
	onClose: () => void;
	drivers: CheckListDriver[] | null;
};

export default function CheckListChatModal({ isOpen, onClose, drivers }: CheckListChatModalProps) {
	const [message, setMessage] = useState("");
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const addChatRoom = useChatStore(s => s.addChatRoom);

	const targets = drivers ?? [];
	const targetKey = useMemo(() => targets.map(d => d.id).join(","), [targets]);
	const hasMessage = message.trim().length > 0;

	useEffect(() => {
		if (isOpen) {
			setMessage("");
			setError(null);
			setSuccess(null);
		}
	}, [isOpen, targetKey]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		if (targets.length === 0) return;

		const text = message.trim();
		setSending(true);

		try {
			const summary = await bulkCreatePrivateChatsWithMessage(
				targets.map(d => d.id),
				text || undefined,
			);

			for (const item of summary.items) {
				if (item.status !== "created" || !item.chatRoom) continue;
				const normalized = normalizeBulkDirectChatRoom(item.chatRoom);
				addChatRoom(normalized);
				await indexedDBChatService.addChatRoom(normalized).catch(() => {});
			}

			const messageErrors = summary.items.filter(
				item => item.messageError && item.messageSent === false,
			);

			if (!text) {
				showBulkPrivateChatsToast(summary);
				window.setTimeout(() => onClose(), 800);
				return;
			}

			const chatSummary = `Chats — created: ${summary.created}, already existed: ${summary.existed}, errors: ${summary.errors}`;
			const messagesSent = summary.messagesSent ?? 0;

			if (messageErrors.length === 0) {
				setSuccess(
					targets.length === 1
						? "Chat ready. Message sent."
						: `Messages sent to ${messagesSent} drivers. ${chatSummary}`,
				);
				window.setTimeout(() => onClose(), 800);
			} else if (messagesSent === 0) {
				setError(
					`${chatSummary}. ${messageErrors.map(item => item.messageError).join(" ")}`,
				);
			} else {
				setSuccess(`Messages sent to ${messagesSent} of ${targets.length} drivers. ${chatSummary}`);
				setError(
					`Failed for some: ${messageErrors.map(item => item.messageError).join(" ")}`,
				);
				window.setTimeout(() => onClose(), 1200);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create private chats");
		} finally {
			setSending(false);
		}
	}

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create chat</h2>

				<div className="mt-5">
					<Label htmlFor="checklist-chat-message">Message</Label>
					<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Optional. Leave empty to only create chats.
					</p>
					<div className="mt-1.5">
						<TextArea
							id="checklist-chat-message"
							rows={5}
							value={message}
							onChange={setMessage}
							placeholder="Type a message to send after the chat is created…"
							className="min-h-[120px] resize-y"
						/>
					</div>
				</div>

				{error && (
					<div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
						{error}
					</div>
				)}
				{success && (
					<div className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
						{success}
					</div>
				)}

				<div className="mt-6 flex flex-wrap justify-end gap-3">
					<Button type="button" variant="outline" size="sm" onClick={onClose} disabled={sending}>
						Cancel
					</Button>
					<Button type="submit" variant="primary" size="sm" disabled={sending || targets.length === 0}>
						{sending ? "Working…" : hasMessage ? "Send" : "Create"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
