import type React from "react";
import Link from "next/link";

interface DropdownItemProps {
	tag?: "a" | "button" | "div";
	href?: string;
	onClick?: () => void;
	onItemClick?: (event?: React.MouseEvent) => void;
	baseClassName?: string;
	className?: string;
	children: React.ReactNode;
	disabled?: boolean;
	title?: string;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
	tag = "button",
	href,
	onClick,
	onItemClick,
	baseClassName = "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900",
	className = "",
	children,
	disabled = false,
	title,
}) => {
	const combinedClasses = `${baseClassName} ${className}`.trim();

	const handleClick = (event: React.MouseEvent) => {
		if (disabled) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (tag === "button") {
			event.preventDefault();
		}
		if (onClick) onClick();
		if (onItemClick) onItemClick(event);
	};

	if (tag === "a" && href) {
		return (
			<Link href={href} className={combinedClasses} onClick={handleClick} title={title}>
				{children}
			</Link>
		);
	}

	if (tag === "div") {
		return (
			<div onClick={handleClick} className={combinedClasses} title={title}>
				{children}
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={combinedClasses}
			disabled={disabled}
			title={title}
		>
			{children}
		</button>
	);
};
