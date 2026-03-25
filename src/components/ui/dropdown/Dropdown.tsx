"use client";
import { cn } from "@/utils";
import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createPopper, type Instance } from "@popperjs/core";

interface DropdownProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	/** When set, uses Popper.js for correct positioning (portal to body) */
	anchorRef?: React.RefObject<HTMLElement | null>;
	/** Popper placement: 'bottom-start' = left align, 'bottom-end' = right align */
	anchorAlign?: "left" | "right";
}

export const Dropdown: React.FC<DropdownProps> = ({
	isOpen,
	onClose,
	children,
	className = "",
	anchorRef,
	anchorAlign = "left",
}) => {
	const dropdownRef = useRef<HTMLDivElement>(null);
	const popperInstanceRef = useRef<Instance | null>(null);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				!(event.target as HTMLElement).closest(".dropdown-toggle")
			) {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [onClose]);

	// Popper: create/update/destroy when isOpen or anchorRef changes
	useEffect(() => {
		if (!isOpen || !anchorRef?.current || !dropdownRef.current) {
			if (popperInstanceRef.current) {
				popperInstanceRef.current.destroy();
				popperInstanceRef.current = null;
			}
			return;
		}
		popperInstanceRef.current = createPopper(anchorRef.current, dropdownRef.current, {
			placement: anchorAlign === "right" ? "bottom-end" : "bottom-start",
			strategy: "fixed",
			modifiers: [
				{ name: "offset", options: { offset: [0, 4] } },
				{ name: "flip", options: { fallbackPlacements: ["top-end", "top-start"] } },
				{ name: "preventOverflow" },
			],
		});
		return () => {
			if (popperInstanceRef.current) {
				popperInstanceRef.current.destroy();
				popperInstanceRef.current = null;
			}
		};
	}, [isOpen, anchorRef, anchorAlign]);

	// Update popper position when opened
	useEffect(() => {
		if (isOpen && popperInstanceRef.current) {
			popperInstanceRef.current.update();
		}
	}, [isOpen]);

	if (!isOpen) return null;

	const baseClass =
		"z-[9999] rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark";

	if (anchorRef?.current && typeof document !== "undefined") {
		return createPortal(
			<div ref={dropdownRef} className={cn(baseClass, className)}>
				{children}
			</div>,
			document.body
		);
	}

	return (
		<div
			ref={dropdownRef}
			className={cn("absolute right-0 mt-2", baseClass, className)}
		>
			{children}
		</div>
	);
};
