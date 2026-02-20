"use client";
import { cn } from "@/utils";
import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
	/** When set, renders via portal with fixed positioning to avoid overflow clipping (e.g. in scrollable lists) */
	anchorRef?: React.RefObject<HTMLElement | null>;
}

export const Dropdown: React.FC<DropdownProps> = ({
	isOpen,
	onClose,
	children,
	className = "",
	anchorRef,
}) => {
	const dropdownRef = useRef<HTMLDivElement>(null);

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

	if (!isOpen) return null;

	const baseClass =
		"z-[9999] rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark";

	if (anchorRef?.current && typeof document !== "undefined") {
		const rect = anchorRef.current.getBoundingClientRect();
		const style: React.CSSProperties = {
			position: "fixed",
			top: rect.bottom + 4,
			left: rect.left,
		};
		return createPortal(
			<div ref={dropdownRef} className={cn(baseClass, className)} style={style}>
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
