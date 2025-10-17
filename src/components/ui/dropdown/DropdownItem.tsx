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
}

export const DropdownItem: React.FC<DropdownItemProps> = ({
	tag = "button",
	href,
	onClick,
	onItemClick,
	baseClassName = "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900",
	className = "",
	children,
}) => {
	const combinedClasses = `${baseClassName} ${className}`.trim();

	const handleClick = (event: React.MouseEvent) => {
		if (tag === "button") {
			event.preventDefault();
		}
		if (onClick) onClick();
		if (onItemClick) onItemClick(event);
	};

	if (tag === "a" && href) {
		return (
			<Link href={href} className={combinedClasses} onClick={handleClick}>
				{children}
			</Link>
		);
	}

	if (tag === "div") {
		return (
			<div onClick={handleClick} className={combinedClasses}>
				{children}
			</div>
		);
	}

	return (
		<button onClick={handleClick} className={combinedClasses}>
			{children}
		</button>
	);
};
