"use client";

import { useEffect, useState, FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import type { CheckListDriver } from "./checkListTypes";

export const CHECK_LIST_PUSH_DEFAULT_MESSAGE =
	"We have not received location updates from you for a while. Please check whether push notifications are enabled for the app.";

type CheckListPushModalProps = {
	isOpen: boolean;
	onClose: () => void;
	driver: CheckListDriver | null;
};

export default function CheckListPushModal({ isOpen, onClose, driver }: CheckListPushModalProps) {
	const [message, setMessage] = useState(CHECK_LIST_PUSH_DEFAULT_MESSAGE);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setMessage(CHECK_LIST_PUSH_DEFAULT_MESSAGE);
			setError(null);
			setSuccess(null);
		}
	}, [isOpen, driver?.id]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		const text = message.trim();
		if (!text) {
			setError("Please enter a message.");
			return;
		}
		if (!driver) return;

		const ext = driver.externalId?.trim();
		const body: Record<string, unknown> = {
			message: text,
			platform: null,
		};
		if (ext) {
			body.externalId = ext;
			body.userId = null;
		} else {
			body.userId = driver.id;
		}

		setSending(true);
		try {
			const res = await fetch("/api/v1/notifications/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(body),
			});
			const json = (await res.json().catch(() => ({}))) as {
				error?: string;
				message?: string;
				success?: boolean;
			};
			if (!res.ok) {
				const msg =
					(typeof json.error === "string" ? json.error : null) ??
					(typeof json.message === "string" ? json.message : null) ??
					"Failed to send push notification.";
				setError(msg);
				return;
			}
			setSuccess("Push sent.");
			window.setTimeout(() => {
				onClose();
			}, 800);
		} catch {
			setError("Network error while sending push.");
		} finally {
			setSending(false);
		}
	}

	const driverLabel =
		driver &&
		`${driver.firstName} ${driver.lastName}`.trim() +
			(driver.externalId ? ` · ID: ${driver.externalId}` : "");

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Send push notification
				</h2>
				{driverLabel && (
					<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{driverLabel}</p>
				)}

				<div className="mt-5">
					<Label htmlFor="checklist-push-message">Message</Label>
					<div className="mt-1.5">
						<TextArea
							id="checklist-push-message"
							rows={5}
							value={message}
							onChange={setMessage}
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
					<Button type="submit" variant="primary" size="sm" disabled={sending || !driver}>
						{sending ? "Sending…" : "Send"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
