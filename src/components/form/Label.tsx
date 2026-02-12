import React, { FC, ReactNode } from "react";
import { twMerge } from "tailwind-merge";

interface LabelProps {
	htmlFor?: string;
	children: ReactNode;
	className?: string;
}

const Label: FC<LabelProps> = ({ htmlFor, children, className }) => {
	return (
		<label
			htmlFor={htmlFor}
			className={twMerge(
				// Default: same style in popups and table filters; white in dark theme
				"mb-1.5 block text-sm font-medium text-gray-700 dark:text-white",

				// User-defined className that can override the default margin
				className
			)}
		>
			{children}
		</label>
	);
};

export default Label;
