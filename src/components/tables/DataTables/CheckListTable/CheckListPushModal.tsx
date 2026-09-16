"use client";

import { useEffect, useState, FormEvent, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import TextArea from "@/components/form/input/TextArea";
import Button from "@/components/ui/button/Button";
import SendIcon from "./SendIcon";
import CloseIcon from "./CloseIcon";
import { useCurrentUser } from "@/stores/userStore";
import { canAccessCheckListMassEmail, canSendCheckListMessages } from "@/utils/roleAccess";
import type { CheckListDriver } from "./checkListTypes";
import { formatDriverShortLabel } from "./checkListTypes";
import {
	massPushProgressPercent,
	startMassPushBroadcast,
	watchMassPushBroadcast,
	type MassPushJobSnapshot,
} from "./checkListMassPush";

export const CHECK_LIST_PUSH_DEFAULT_MESSAGE =
	"We haven't received location updates from you in a while. Please check if the app is running.";

export function buildCheckListVersionPushDefaultMessage(
	minimumAppVersion: string,
): string {
	const version = minimumAppVersion.trim();
	if (!version) {
		return "You have an unacceptable app version. Please update your app to the latest allowed version.";
	}
	return `You have an unacceptable app version. The latest allowed version is ${version}. Please update your app.`;
}

function buildPushBody(
	driver: CheckListDriver,
	message: string,
	offerContext?: { offerId: number; offerTitle: string },
): Record<string, unknown> {
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
	if (offerContext) {
		body.offerId = offerContext.offerId;
		body.offerTitle = offerContext.offerTitle;
	}
	return body;
}

/** One request for many drivers — backend queues delivery in the background. */
function buildBatchPushBody(
	drivers: CheckListDriver[],
	message: string,
	offerContext?: { offerId: number; offerTitle: string },
): Record<string, unknown> {
	const text = message.trim();
	const externalIds: string[] = [];
	const userIds: string[] = [];

	for (const driver of drivers) {
		const ext = driver.externalId?.trim();
		if (ext) {
			externalIds.push(ext);
		} else if (driver.id?.trim()) {
			userIds.push(driver.id.trim());
		}
	}

	const body: Record<string, unknown> = {
		message: text,
		platform: null,
		externalIds,
		userIds,
	};
	if (offerContext) {
		body.offerId = offerContext.offerId;
		body.offerTitle = offerContext.offerTitle;
	}
	return body;
}

function driverShortLabel(driver: CheckListDriver): string {
	return formatDriverShortLabel(driver);
}

function showPushSentToast(message: string): void {
	const addSystemToast = (
		window as unknown as {
			addSystemToastNotification?: (n: {
				id: string;
				title: string;
				message: string;
				variant?: "success" | "error" | "default";
			}) => void;
		}
	).addSystemToastNotification;

	if (typeof addSystemToast !== "function") return;

	addSystemToast({
		id: `check-list-push-sent-${Date.now()}`,
		title: "Push notification",
		message,
		variant: "success",
	});
}

type CheckListPushModalProps = {
	isOpen: boolean;
	onClose: () => void;
	/** When null, modal is treated as closed. Otherwise send to this list (one or many). */
	drivers: CheckListDriver[] | null;
	defaultMessage?: string;
	offerContext?: { offerId: number; offerTitle: string };
	onSent?: () => void | Promise<void>;
	/** Mass broadcast: hide driver list and send to all eligible drivers. */
	hideRecipients?: boolean;
};

export default function CheckListPushModal({
	isOpen,
	onClose,
	drivers,
	defaultMessage = CHECK_LIST_PUSH_DEFAULT_MESSAGE,
	offerContext,
	onSent,
	hideRecipients = false,
}: CheckListPushModalProps) {
	const currentUser = useCurrentUser();
	const canSend = hideRecipients
		? canAccessCheckListMassEmail(currentUser?.role)
		: canSendCheckListMessages(currentUser?.role);
	const [message, setMessage] = useState(defaultMessage);
	const [sending, setSending] = useState(false);
	const [massJob, setMassJob] = useState<MassPushJobSnapshot | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const targets = drivers ?? [];
	const targetKey = useMemo(() => targets.map((d) => d.id).join(","), [targets]);

	useEffect(() => {
		if (isOpen) {
			setMessage(defaultMessage);
			setError(null);
			setSuccess(null);
			setMassJob(null);
			setSending(false);
		}
	}, [isOpen, targetKey, defaultMessage]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		if (!canSend) return;
		setError(null);
		setSuccess(null);
		const text = message.trim();
		if (!text) {
			setError("Please enter a message.");
			return;
		}
		if (targets.length === 0) {
			if (hideRecipients) {
				setSending(true);
				try {
					const started = await startMassPushBroadcast(text);
					if (!started.jobId) {
						throw new Error("Mass push job was not created.");
					}
					setMassJob(started);
					const finalJob = await watchMassPushBroadcast(started.jobId, setMassJob);
					if (finalJob.status === "failed") {
						setError(finalJob.error ?? "Mass push failed.");
						return;
					}
					if (finalJob.total === 0) {
						setSuccess("No eligible drivers to notify.");
						return;
					}
					if (finalJob.failed === 0) {
						setSuccess(`Push sent to ${finalJob.sent} drivers.`);
						return;
					}
					setSuccess(`Push sent to ${finalJob.sent} of ${finalJob.total} drivers.`);
					setError(
						finalJob.failed === 1
							? "1 push failed."
							: `${finalJob.failed} pushes failed.`,
					);
				} catch (err) {
					if (err instanceof DOMException && err.name === "AbortError") {
						return;
					}
					setError(
						err instanceof Error ? err.message : "Network error while sending push.",
					);
				} finally {
					setSending(false);
				}
				return;
			}
			return;
		}

		setSending(true);

		try {
			if (targets.length > 1) {
				const res = await fetch("/api/v1/notifications/push", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify(buildBatchPushBody(targets, text, offerContext)),
				});
				const json = (await res.json().catch(() => ({}))) as {
					error?: string;
					message?: string;
					success?: boolean;
					data?: { queued?: boolean; users?: number };
				};
				if (!res.ok) {
					const msg =
						(typeof json.error === "string" ? json.error : null) ??
						(typeof json.message === "string" ? json.message : null) ??
						"Failed to send push notification.";
					setError(msg);
					return;
				}

				await onSent?.();
				showPushSentToast(
					targets.length === 1
						? `Push sent to ${driverShortLabel(targets[0])}.`
						: `Push sent to ${targets.length} drivers.`,
				);
				onClose();
				return;
			}

			const driver = targets[0];
			const res = await fetch("/api/v1/notifications/push", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify(buildPushBody(driver, text, offerContext)),
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
				setError(`${driverShortLabel(driver)}: ${msg}`);
				return;
			}

			await onSent?.();
			showPushSentToast(`Push sent to ${driverShortLabel(driver)}.`);
			onClose();
		} catch {
			setError("Network error while sending push.");
		} finally {
			setSending(false);
		}
	}

	const summaryLabel =
		targets.length === 1
			? driverShortLabel(targets[0])
			: `${targets.length} drivers selected`;

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick={!sending}
			closeOnEscape={!sending}
			showCloseButton={!sending}
		>
			<form onSubmit={onSubmit} className="p-6">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-white">
					Send push notification
				</h2>
				{!hideRecipients && targets.length > 0 && (
					<>
						<p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{summaryLabel}</p>
						{offerContext ? (
							<p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
								Offer - {offerContext.offerTitle}
							</p>
						) : null}
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
					<Label htmlFor={hideRecipients ? "checklist-mass-push-message" : "checklist-push-message"}>Message</Label>
					<div className="mt-1.5">
						<TextArea
							id={hideRecipients ? "checklist-mass-push-message" : "checklist-push-message"}
							rows={5}
							value={message}
							onChange={setMessage}
							className="min-h-[120px] resize-y"
							disabled={sending}
						/>
					</div>
				</div>

				{hideRecipients && massJob?.jobId && (
					<div className="mt-4" aria-live="polite">
						<div className="mb-1.5 flex items-center justify-between gap-3 text-sm text-gray-700 dark:text-gray-300">
							<span>
								{massJob.status === "queued"
									? "Preparing recipients…"
									: massJob.status === "running"
										? `Sending ${massJob.processed ?? 0} of ${massJob.total ?? 0}…`
										: massJob.status === "failed"
											? "Sending stopped"
											: (massJob.total ?? 0) === 0
												? "No eligible drivers"
												: `Sent ${massJob.sent ?? 0} of ${massJob.total ?? 0}`}
							</span>
							<span className="font-medium tabular-nums">
								{massPushProgressPercent(massJob)}%
							</span>
						</div>
						<div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
							<div
								className="h-full rounded-full bg-success-500 transition-[width] duration-300"
								style={{ width: `${massPushProgressPercent(massJob)}%` }}
							/>
						</div>
						<p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
							Sent {massJob.sent ?? 0}
							{(massJob.failed ?? 0) > 0 ? ` · Failed ${massJob.failed}` : ""}
							{(massJob.total ?? 0) > 0 ? ` · Total ${massJob.total}` : ""}
						</p>
					</div>
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
					<Button
						type="button"
						variant="outline"
						size="sm"
						startIcon={<CloseIcon className="h-4 w-4" />}
						onClick={onClose}
						disabled={sending}
					>
						{hideRecipients && !sending ? "Close" : "Cancel"}
					</Button>
					<Button
						type="submit"
						variant="primary"
						size="sm"
						startIcon={<SendIcon className="h-4 w-4" />}
						disabled={!canSend || sending || (!hideRecipients && targets.length === 0)}
					>
						{sending ? "Sending…" : "Send"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
