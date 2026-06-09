"use client";

import { useEffect, useState, FormEvent, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import type { CheckListDriver } from "./checkListTypes";

export const CHECK_LIST_PUSH_DEFAULT_MESSAGE =
	"We haven't received location updates from you in a while. Please check if the app is running.";

function buildPushBody(driver: CheckListDriver, message: string): Record<string, unknown> {
	const text = message.trim();
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
	return body;
}

function driverShortLabel(driver: CheckListDriver): string {
	const name = `${driver.firstName} ${driver.lastName}`.trim() || "—";
	return driver.externalId ? `${name} (ID: ${driver.externalId})` : name;
}

type CheckListPushModalProps = {
	isOpen: boolean;
	onClose: () => void;
	/** When null, modal is treated as closed. Otherwise send to this list (one or many). */
	drivers: CheckListDriver[] | null;
	defaultMessage?: string;
};

export default function CheckListPushModal({
	isOpen,
	onClose,
	drivers,
	defaultMessage = CHECK_LIST_PUSH_DEFAULT_MESSAGE,
}: CheckListPushModalProps) {
	const [message, setMessage] = useState(defaultMessage);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const targets = drivers ?? [];
	const targetKey = useMemo(() => targets.map((d) => d.id).join(","), [targets]);

	useEffect(() => {
		if (isOpen) {
			setMessage(defaultMessage);
			setError(null);
			setSuccess(null);
		}
	}, [isOpen, targetKey, defaultMessage]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		const text = message.trim();
		if (!text) {
			setError("Please enter a message.");
			return;
		}
		if (targets.length === 0) return;

		setSending(true);
		const failures: string[] = [];

		try {
			for (const driver of targets) {
				const res = await fetch("/api/v1/notifications/push", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify(buildPushBody(driver, text)),
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
					failures.push(`${driverShortLabel(driver)}: ${msg}`);
				}
			}

			if (failures.length === 0) {
				setSuccess(
					targets.length === 1
						? "Push sent."
						: `Push sent to ${targets.length} drivers.`,
				);
				window.setTimeout(() => {
					onClose();
				}, 800);
			} else if (failures.length === targets.length) {
				setError(failures.join(" "));
			} else {
				const ok = targets.length - failures.length;
				setSuccess(`Push sent to ${ok} of ${targets.length} drivers.`);
				setError(`Failed for some: ${failures.join(" ")}`);
				window.setTimeout(() => {
					onClose();
				}, 1200);
			}
		} catch {
			setError("Network error while sending push.");
		} finally {
			setSending(false);
		}
	}

	const summaryLabel =
		targets.length === 1 ? driverShortLabel(targets[0]) : `${targets.length} drivers selected`;

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
				{targets.length > 0 && (
					<>
						<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{summaryLabel}</p>
						{targets.length > 1 && (
							<ul className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
								{targets.map((d) => (
									<li key={d.id} className="truncate py-0.5">
										{driverShortLabel(d)}
									</li>
								))}
							</ul>
						)}
					</>
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
					<Button type="submit" variant="primary" size="sm" disabled={sending || targets.length === 0}>
						{sending ? "Sending…" : "Send"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
