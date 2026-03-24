"use client";

import React, { useState, useEffect, useCallback } from "react";

export type SystemToastVariant = "success" | "error" | "default";

export interface SystemToastData {
	id: string;
	title: string;
	message: string;
	avatar?: string;
	/** success = green bg, error = red bg, default = neutral */
	variant?: SystemToastVariant;
}

interface SystemToastNotificationProps {
	data: SystemToastData;
	onClose: () => void;
	autoCloseDelay?: number;
}

export const SystemToastNotification: React.FC<SystemToastNotificationProps> = ({
	data,
	onClose,
	autoCloseDelay = 5000,
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);

	const handleClose = useCallback(() => {
		setIsClosing(true);
		setTimeout(() => onClose(), 300);
	}, [onClose]);

	useEffect(() => {
		const showTimer = setTimeout(() => setIsVisible(true), 100);
		const closeTimer = setTimeout(() => handleClose(), autoCloseDelay);

		return () => {
			clearTimeout(showTimer);
			clearTimeout(closeTimer);
		};
	}, [autoCloseDelay, handleClose]);

	const generateInitials = (name: string) => {
		const words = name.trim().split(/\s+/);
		if (words.length === 1) {
			return words[0].substring(0, 2).toUpperCase();
		}
		return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
	};

	const variantStyles: Record<NonNullable<SystemToastData["variant"]>, string> = {
		success:
			"bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-700",
		error:
			"bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-700",
		default:
			"bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
	};
	const variantClass = variantStyles[data.variant ?? "default"];

	return (
		<div
			className={`w-80 rounded-lg shadow-lg border ${variantClass} transform transition-all duration-300 ease-in-out ${
				isVisible && !isClosing ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
			}`}
		>
			<div className="p-4">
				<div className="flex items-start space-x-3">
					<div className="flex-shrink-0">
						{data.avatar ? (
							<img
								src={data.avatar}
								alt={data.title}
								className="w-10 h-10 rounded-full object-cover"
								onError={(e) => {
									const target = e.target as HTMLImageElement;
									target.style.display = "none";
									const parent = target.parentElement;
									if (parent) {
										parent.innerHTML = `<div class="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-full">${generateInitials(data.title)}</div>`;
									}
								}}
							/>
						) : (
							<div className="w-10 h-10 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-full">
								{generateInitials(data.title)}
							</div>
						)}
					</div>

					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
								{data.title}
							</h4>
							<button
								onClick={handleClose}
								className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
							>
								<svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>

						<p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
							{data.message}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
