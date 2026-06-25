"use client";

import { useEffect, useState, FormEvent, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { useCurrentUser } from "@/stores/userStore";
import { canSendCheckListMessages } from "@/utils/roleAccess";
import type { CheckListDriver } from "./checkListTypes";
import { formatDriverShortLabel } from "./checkListTypes";
import { CHECK_LIST_PUSH_DEFAULT_MESSAGE } from "./CheckListPushModal";
import {
	bulkSendCheckListEmails,
	formatBulkEmailFailure,
	type BulkEmailProgress,
} from "./checkListBulkEmail";

export const CHECK_LIST_EMAIL_DEFAULT_SUBJECT = "Odyssea";

export const CHECK_LIST_VERSION_EMAIL_DEFAULT_MESSAGE = `Hello,

Please update the Odysseia mobile application to the latest version at your earliest convenience.

You are currently using an outdated version of the app. After performing this manual update, future updates should be installed automatically.

We apologize for the inconvenience and appreciate your cooperation.

iOS: https://apps.apple.com/ua/app/odysseia-app/id6756887777

Android: https://play.google.com/store/search?q=odysseia&c=apps&hl=en

Thank you.`;

function driverShortLabel(driver: CheckListDriver): string {
	return formatDriverShortLabel(driver);
}

type CheckListEmailModalProps = {
	isOpen: boolean;
	onClose: () => void;
	drivers: CheckListDriver[] | null;
	defaultSubject?: string;
	defaultMessage?: string;
	onSent?: () => void | Promise<void>;
};

export default function CheckListEmailModal({
	isOpen,
	onClose,
	drivers,
	defaultSubject = CHECK_LIST_EMAIL_DEFAULT_SUBJECT,
	defaultMessage = CHECK_LIST_PUSH_DEFAULT_MESSAGE,
	onSent,
}: CheckListEmailModalProps) {
	const currentUser = useCurrentUser();
	const canSend = canSendCheckListMessages(currentUser?.role);
	const [subject, setSubject] = useState(defaultSubject);
	const [message, setMessage] = useState(defaultMessage);
	const [sending, setSending] = useState(false);
	const [progress, setProgress] = useState<BulkEmailProgress | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const targets = drivers ?? [];
	const targetKey = useMemo(() => targets.map(d => d.id).join(","), [targets]);

	useEffect(() => {
		if (isOpen) {
			setSubject(defaultSubject);
			setMessage(defaultMessage);
			setError(null);
			setSuccess(null);
			setProgress(null);
		}
	}, [isOpen, targetKey, defaultSubject, defaultMessage]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!canSend) return;
		setError(null);
		setSuccess(null);
		const subj = subject.trim();
		const text = message.trim();
		if (!subj) {
			setError("Please enter a subject.");
			return;
		}
		if (!text) {
			setError("Please enter a message.");
			return;
		}
		if (targets.length === 0) return;

		setSending(true);
		setProgress({ completed: 0, total: targets.length });

		try {
			const summary = await bulkSendCheckListEmails(targets, subj, text, setProgress);
			const failures = summary.items.filter(item => !item.sent);

			if (failures.length === 0) {
				await onSent?.();
				setSuccess(
					targets.length === 1
						? "Email sent."
						: `Email sent to ${summary.sent} drivers.`,
				);
				window.setTimeout(() => onClose(), 800);
			} else if (summary.sent === 0) {
				setError(failures.map(formatBulkEmailFailure).join(" "));
			} else {
				setSuccess(`Email sent to ${summary.sent} of ${targets.length} drivers.`);
				setError(`Failed for some: ${failures.map(formatBulkEmailFailure).join(" ")}`);
				window.setTimeout(() => onClose(), 1200);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error while sending email.");
		} finally {
			setSending(false);
			setProgress(null);
		}
	}

	const summaryLabel =
		targets.length === 1 ? driverShortLabel(targets[0]) : `${targets.length} drivers selected`;

	const progressLabel =
		progress && progress.total > 1
			? `Sending ${progress.completed} of ${progress.total} drivers…`
			: null;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick={!sending}
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Send email</h2>
				{targets.length > 0 && (
					<>
						<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{summaryLabel}</p>
						{targets.length > 1 && (
							<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Emails are processed in small batches.
							</p>
						)}
						{targets.length > 1 && (
							<ul className="mt-2 max-h-28 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
								{targets.map(d => (
									<li key={d.id} className="truncate py-0.5">
										{driverShortLabel(d)}
										{d.email ? ` — ${d.email}` : " — no email"}
									</li>
								))}
							</ul>
						)}
					</>
				)}

				<div className="mt-5">
					<Label htmlFor="checklist-email-subject">Subject</Label>
					<div className="mt-1.5">
						<Input
							id="checklist-email-subject"
							value={subject}
							onChange={e => setSubject(e.target.value)}
							disabled={sending}
						/>
					</div>
				</div>

				<div className="mt-5">
					<Label htmlFor="checklist-email-message">Message</Label>
					<div className="mt-1.5">
						<TextArea
							id="checklist-email-message"
							rows={10}
							value={message}
							onChange={setMessage}
							className="min-h-[120px] resize-y"
							disabled={sending}
						/>
					</div>
				</div>

				{sending && progressLabel && (
					<p className="mt-4 text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
						{progressLabel}
					</p>
				)}

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
					<Button
						type="submit"
						variant="primary"
						size="sm"
						disabled={!canSend || sending || targets.length === 0}
					>
						{sending ? progressLabel ?? "Sending…" : "Send"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
