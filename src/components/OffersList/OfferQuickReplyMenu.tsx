"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import offersApi, { type OfferDriver } from "@/app-api/offers";
import { cn } from "@/utils";

const QUICK_REPLY_ITEMS = [
	{ id: "checking", label: "Checking" },
	{ id: "considering", label: "Considering" },
	{ id: "eta", label: "ETA" },
	{ id: "negotiable", label: "Negotiable" },
	{ id: "availability", label: "Availability" },
] as const;

type QuickReplyTemplate = (typeof QUICK_REPLY_ITEMS)[number]["id"];

const MENU_WIDTH = 196;
const MENU_HEIGHT = 248;
const SUCCESS_MESSAGE = "Message sent successfully";
const SEND_ERROR_MESSAGE = "Failed to send message. Try again.";
const OPEN_CHAT_ERROR_MESSAGE = "Failed to open chat. Try again.";

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
	const phaseRef = useRef(phase);
	phaseRef.current = phase;

	useEffect(() => {
		onLockChange(phase === "pending");
		return () => onLockChange(false);
	}, [onLockChange, phase]);

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
			if (phaseRef.current === "pending") return;
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
			if (event.key !== "Escape" || phaseRef.current === "pending") return;
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

	const sendTemplate = async (template: QuickReplyTemplate) => {
		if (phaseRef.current === "pending" || phaseRef.current === "success") return;
		setPhase("pending");
		setErrorText(null);
		const res = await offersApi.sendDriverQuickReply(offerId, unitId, template);
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

	const busy = phase === "pending";

	return createPortal(
		<div
			ref={menuRef}
			role="menu"
			style={{ left: position.left, top: position.top, width: MENU_WIDTH }}
			className="fixed z-[9999] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
		>
			{phase === "success" ? (
				<div className="flex min-h-[220px] items-center justify-center px-3 text-center text-sm font-medium text-green-700 dark:text-green-300">
					{SUCCESS_MESSAGE}
				</div>
			) : (
				<>
					{errorText ? (
						<p className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{errorText}</p>
					) : null}
					{QUICK_REPLY_ITEMS.map((item) => (
						<button
							key={item.id}
							type="button"
							role="menuitem"
							disabled={busy}
							onClick={() => void sendTemplate(item.id)}
							className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/5"
						>
							{item.label}
						</button>
					))}
					<button
						type="button"
						role="menuitem"
						disabled={busy}
						onClick={() => void openCustomReply()}
						className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:text-gray-100 dark:hover:bg-white/5"
					>
						Custom Reply
					</button>
				</>
			)}
		</div>,
		document.body
	);
}
