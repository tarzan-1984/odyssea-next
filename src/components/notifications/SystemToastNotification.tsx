"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
	SYSTEM_TOAST_AUTO_CLOSE_MS,
	getToastSlideClasses,
	isToastSlideFromLeft,
} from "@/constants/toastNotifications";
import { useToastPositionStore } from "@/stores/toastPositionStore";

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
	autoCloseDelay = SYSTEM_TOAST_AUTO_CLOSE_MS,
}) => {
	const [isVisible, setIsVisible] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const [isHovered, setIsHovered] = useState(false);
	const [avatarError, setAvatarError] = useState(false);
	const toastPosition = useToastPositionStore(state => state.position);
	const slideFromLeft = isToastSlideFromLeft(toastPosition);

	const handleClose = useCallback(() => {
		setIsClosing(true);
		setTimeout(() => onClose(), 300);
	}, [onClose]);

	useEffect(() => {
		const showTimer = setTimeout(() => setIsVisible(true), 100);
		return () => clearTimeout(showTimer);
	}, []);

	useEffect(() => {
		if (isHovered || isClosing) return;

		const closeTimer = setTimeout(() => handleClose(), autoCloseDelay);

		return () => clearTimeout(closeTimer);
	}, [autoCloseDelay, handleClose, isClosing, isHovered]);

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
			className={`w-[min(calc(100vw-2rem),17.5rem)] xl:w-80 rounded-lg shadow-lg border ${variantClass} transform transition-all duration-300 ease-in-out ${getToastSlideClasses(
				isVisible,
				isClosing,
				slideFromLeft
			)}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="p-3 xl:p-4">
				<div className="flex items-start gap-2 xl:gap-3">
					<div className="flex-shrink-0">
						{data.avatar && !avatarError ? (
							<img
								src={data.avatar}
								alt={data.title}
								className="h-8 w-8 rounded-full object-cover xl:h-10 xl:w-10"
								onError={() => setAvatarError(true)}
							/>
						) : (
							<div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300 xl:h-10 xl:w-10 xl:text-sm">
								{generateInitials(data.title)}
							</div>
						)}
					</div>

					<div className="flex-1 min-w-0">
						<div className="flex items-center justify-between">
							<h4 className="truncate text-xs font-medium text-gray-900 dark:text-white xl:text-sm">
								{data.title}
							</h4>
							<button
								onClick={handleClose}
								className="ml-1.5 flex-shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300 xl:ml-2"
							>
								<svg className="h-3.5 w-3.5 xl:h-4 xl:w-4" fill="currentColor" viewBox="0 0 20 20">
									<path
										fillRule="evenodd"
										d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
						</div>

						<p className="mt-0.5 text-xs leading-snug text-gray-600 dark:text-gray-300 xl:mt-1 xl:text-sm xl:leading-relaxed">
							{data.message}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
