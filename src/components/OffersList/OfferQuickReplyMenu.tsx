"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import offersApi, { type OfferDriver, type OfferQuickReplyTemplate } from "@/app-api/offers";
import Button from "@/components/ui/button/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/utils";

const MENU_WIDTH = 260;
const MENU_HEIGHT = 320;
const SUCCESS_MESSAGE = "Message sent successfully";
const SEND_ERROR_MESSAGE = "Failed to send message. Try again.";
const OPEN_CHAT_ERROR_MESSAGE = "Failed to open chat. Try again.";
const LOAD_ERROR_MESSAGE = "Failed to load templates.";
const SAVE_ERROR_MESSAGE = "Failed to save template. Try again.";
const DELETE_ERROR_MESSAGE = "Failed to delete template. Try again.";
const REQUIRED_FIELDS_MESSAGE = "Title and message are required.";

type EditorState =
	| { mode: "create" }
	| { mode: "edit"; template: OfferQuickReplyTemplate };

export function canQuickReplyDriverBid(
	driver: Pick<OfferDriver, "active" | "is_selected" | "rate" | "quick_reply_sent">,
	canModifyOffersByRole: boolean
): boolean {
	return (
		canModifyOffersByRole &&
		driver.active !== false &&
		driver.is_selected !== true &&
		driver.rate != null &&
		driver.quick_reply_sent !== true
	);
}

function menuPosition(anchor: HTMLElement): { left: number; top: number } {
	const rect = anchor.getBoundingClientRect();
	const left = Math.min(
		Math.max(8, rect.left),
		Math.max(8, window.innerWidth - MENU_WIDTH - 8)
	);
	const spaceBelow = window.innerHeight - rect.bottom;
	const top =
		spaceBelow < MENU_HEIGHT && rect.top > MENU_HEIGHT
			? Math.max(8, rect.top - MENU_HEIGHT - 6)
			: rect.bottom + 6;
	return { left, top };
}

export function DriverBidRateButton({
	label,
	className,
	enabled,
	onOpen,
}: {
	label: string;
	className?: string;
	enabled: boolean;
	onOpen: (anchor: HTMLButtonElement) => void;
}) {
	if (!enabled) {
		return <span className={className}>{label}</span>;
	}

	return (
		<button
			type="button"
			data-quick-reply-rate=""
			title="Quick reply"
			className={cn(
				"cursor-pointer border-0 bg-transparent p-0 text-inherit",
				className
			)}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
				onOpen(event.currentTarget);
			}}
		>
			{label}
		</button>
	);
}

export default function OfferQuickReplyMenu({
	offerId,
	unitId,
	anchor,
	onClose,
	onSent,
	onCustomReply,
	onLockChange,
}: {
	offerId: number;
	unitId: string;
	anchor: HTMLElement;
	onClose: () => void;
	onSent: () => void;
	onCustomReply: () => Promise<{ success: boolean }>;
	onLockChange: (locked: boolean) => void;
}) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState(() => menuPosition(anchor));
	const [phase, setPhase] = useState<"idle" | "pending" | "success" | "error">("idle");
	const [errorText, setErrorText] = useState<string | null>(null);
	const [templates, setTemplates] = useState<OfferQuickReplyTemplate[]>([]);
	const [loadingTemplates, setLoadingTemplates] = useState(true);
	const [editor, setEditor] = useState<EditorState | null>(null);
	const [draftTitle, setDraftTitle] = useState("");
	const [draftMessage, setDraftMessage] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<OfferQuickReplyTemplate | null>(null);
	const [deleting, setDeleting] = useState(false);
	const phaseRef = useRef(phase);
	const dialogOpenRef = useRef(false);
	phaseRef.current = phase;
	dialogOpenRef.current = editor != null || deleteTarget != null;

	useEffect(() => {
		onLockChange(phase === "pending");
		return () => onLockChange(false);
	}, [onLockChange, phase]);

	useEffect(() => {
		let cancelled = false;
		void offersApi.listQuickReplyTemplates().then((res) => {
			if (cancelled) return;
			if (res.success) setTemplates(res.templates);
			else setErrorText(LOAD_ERROR_MESSAGE);
			setLoadingTemplates(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const update = () => {
			if (anchor.isConnected) setPosition(menuPosition(anchor));
		};
		update();
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);
		return () => {
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [anchor]);

	useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			if (phaseRef.current === "pending" || dialogOpenRef.current) return;
			const target = event.target as HTMLElement | null;
			if (!target) return;
			const quickReplyTarget = target.closest("[data-quick-reply-rate]");
			if (quickReplyTarget) {
				const nestedAction = target.closest("button");
				if (
					!nestedAction ||
					nestedAction === quickReplyTarget ||
					nestedAction.hasAttribute("data-quick-reply-rate")
				) {
					return;
				}
			}
			if (menuRef.current?.contains(target)) return;
			onClose();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || phaseRef.current === "pending" || dialogOpenRef.current) {
				return;
			}
			onClose();
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [onClose]);

	useEffect(() => {
		if (phase !== "success") return;
		const timer = window.setTimeout(onClose, 1000);
		return () => window.clearTimeout(timer);
	}, [onClose, phase]);

	const sendTemplate = async (template: OfferQuickReplyTemplate) => {
		if (phaseRef.current === "pending" || phaseRef.current === "success") return;
		setPhase("pending");
		setErrorText(null);
		const res = await offersApi.sendDriverQuickReply(offerId, unitId, template.id);
		if (res.success || ("alreadySent" in res && res.alreadySent)) {
			onSent();
			setPhase("success");
			return;
		}
		console.error(res.error);
		setErrorText(SEND_ERROR_MESSAGE);
		setPhase("error");
	};

	const openCustomReply = async () => {
		if (phaseRef.current === "pending" || phaseRef.current === "success") return;
		setPhase("pending");
		setErrorText(null);
		const res = await onCustomReply();
		if (res.success) {
			onClose();
			return;
		}
		setErrorText(OPEN_CHAT_ERROR_MESSAGE);
		setPhase("error");
	};

	const openCreate = () => {
		if (phaseRef.current === "pending" || phaseRef.current === "success") return;
		setDraftTitle("");
		setDraftMessage("");
		setFormError(null);
		setEditor({ mode: "create" });
	};

	const openEdit = (template: OfferQuickReplyTemplate) => {
		if (phaseRef.current === "pending" || phaseRef.current === "success") return;
		setDraftTitle(template.title);
		setDraftMessage(template.message);
		setFormError(null);
		setEditor({ mode: "edit", template });
	};

	const closeEditor = () => {
		if (saving) return;
		setEditor(null);
		setFormError(null);
	};

	const saveTemplate = async () => {
		const title = draftTitle.trim();
		const message = draftMessage.trim();
		if (!title || !message) {
			setFormError(REQUIRED_FIELDS_MESSAGE);
			return;
		}
		setSaving(true);
		setFormError(null);
		const res =
			editor?.mode === "edit"
				? await offersApi.updateQuickReplyTemplate(editor.template.id, title, message)
				: await offersApi.createQuickReplyTemplate(title, message);
		setSaving(false);
		if (!res.success) {
			console.error(res.error);
			setFormError(SAVE_ERROR_MESSAGE);
			return;
		}
		setTemplates((current) => {
			if (editor?.mode === "edit") {
				return current.map((item) => (item.id === res.template.id ? res.template : item));
			}
			return [res.template, ...current];
		});
		setEditor(null);
	};

	const confirmDelete = async () => {
		if (!deleteTarget || deleting) return;
		setDeleting(true);
		setErrorText(null);
		const res = await offersApi.deleteQuickReplyTemplate(deleteTarget.id);
		setDeleting(false);
		if (!res.success) {
			console.error(res.error);
			setDeleteTarget(null);
			setErrorText(DELETE_ERROR_MESSAGE);
			return;
		}
		setTemplates((current) => current.filter((item) => item.id !== deleteTarget.id));
		setDeleteTarget(null);
	};

	const busy = phase === "pending";
	const itemClass =
		"block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/5";

	return (
		<>
			{createPortal(
				<div
					ref={menuRef}
					role="menu"
					style={{ left: position.left, top: position.top, width: MENU_WIDTH }}
					className="fixed z-[9999] flex max-h-[320px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
				>
					{phase === "success" ? (
						<div className="flex min-h-[160px] items-center justify-center px-3 text-center text-sm font-medium text-green-700 dark:text-green-300">
							{SUCCESS_MESSAGE}
						</div>
					) : (
						<>
							<button
								type="button"
								disabled={busy}
								onClick={openCreate}
								className="flex w-full shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2 text-left text-sm font-medium text-brand-500 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-gray-800 dark:hover:bg-white/5"
							>
								<Plus className="h-4 w-4 shrink-0" aria-hidden />
								Add template
							</button>
							{errorText ? (
								<p className="shrink-0 px-3 py-2 text-xs text-red-600 dark:text-red-400">
									{errorText}
								</p>
							) : null}
							<div className="min-h-0 flex-1 overflow-y-auto">
								{loadingTemplates ? (
									<p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
								) : (
									templates.map((item) => (
										<div key={item.id} className="flex items-center">
											<button
												type="button"
												role="menuitem"
												title={item.title}
												disabled={busy}
												onClick={() => void sendTemplate(item)}
												className={cn(itemClass, "min-w-0 flex-1 truncate")}
											>
												{item.title}
											</button>
											<button
												type="button"
												aria-label={`Edit ${item.title}`}
												title="Edit template"
												disabled={busy}
												onClick={() => openEdit(item)}
												className="shrink-0 p-2 text-gray-500 hover:text-gray-800 disabled:opacity-60 dark:text-gray-400 dark:hover:text-white"
											>
												<Pencil className="h-3.5 w-3.5" aria-hidden />
											</button>
											<button
												type="button"
												aria-label={`Delete ${item.title}`}
												title="Delete template"
												disabled={busy}
												onClick={() => {
													if (phaseRef.current === "pending" || phaseRef.current === "success") return;
													setDeleteTarget(item);
												}}
												className="mr-1 shrink-0 p-2 text-gray-500 hover:text-red-500 disabled:opacity-60 dark:text-gray-400"
											>
												<Trash2 className="h-3.5 w-3.5" aria-hidden />
											</button>
										</div>
									))
								)}
							</div>
							<button
								type="button"
								role="menuitem"
								disabled={busy}
								onClick={() => void openCustomReply()}
								className={cn(itemClass, "shrink-0 border-t border-gray-200 dark:border-gray-800")}
							>
								Custom Reply
							</button>
						</>
					)}
				</div>,
				document.body
			)}
			<Modal
				isOpen={editor != null}
				onClose={closeEditor}
				closeOnBackdropClick={!saving}
				closeOnEscape={!saving}
				className="relative m-5 w-full max-w-md rounded-3xl bg-white p-6 dark:bg-gray-900 sm:m-0"
			>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void saveTemplate();
					}}
				>
					<h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
						{editor?.mode === "edit" ? "Edit template" : "Add template"}
					</h3>
					<label className="mb-4 block">
						<span className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">Title</span>
						<input
							value={draftTitle}
							onChange={(event) => setDraftTitle(event.target.value)}
							disabled={saving}
							className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-700 dark:text-white"
						/>
					</label>
					<label className="mb-4 block">
						<span className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">Message</span>
						<textarea
							value={draftMessage}
							onChange={(event) => setDraftMessage(event.target.value)}
							disabled={saving}
							rows={5}
							className="w-full resize-y rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-gray-700 dark:text-white"
						/>
					</label>
					{formError ? (
						<p className="mb-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
					) : null}
					<div className="flex justify-end gap-3">
						<Button variant="outline" onClick={closeEditor} disabled={saving}>
							Cancel
						</Button>
						<Button type="submit" disabled={saving}>
							{saving ? "Saving..." : "Save"}
						</Button>
					</div>
				</form>
			</Modal>
			<ConfirmModal
				isOpen={deleteTarget != null}
				onClose={() => {
					if (!deleting) setDeleteTarget(null);
				}}
				onConfirm={() => void confirmDelete()}
				title="Delete template"
				message={
					deleteTarget
						? `Delete "${deleteTarget.title}"? This cannot be undone.`
						: "Delete this template?"
				}
				confirmText="Delete"
				cancelText="Cancel"
				isLoading={deleting}
				icon={<Trash2 className="h-6 w-6" aria-hidden />}
				variant="danger"
			/>
		</>
	);
}
