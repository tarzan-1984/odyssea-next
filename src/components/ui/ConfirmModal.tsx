"use client";
import React from "react";
import { Modal } from "./modal";
import Button from "./button/Button";

interface ConfirmModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	isLoading?: boolean;
	icon?: React.ReactNode;
	variant?: "danger" | "warning" | "info";
}

export default function ConfirmModal({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	isLoading = false,
	icon,
	variant = "danger"
}: ConfirmModalProps) {
	const getVariantStyles = () => {
		switch (variant) {
			case "danger":
				return {
					iconBg: "bg-red-100 dark:bg-red-900/20",
					iconColor: "text-red-600 dark:text-red-400",
					buttonBg: "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
				};
			case "warning":
				return {
					iconBg: "bg-yellow-100 dark:bg-yellow-900/20",
					iconColor: "text-yellow-600 dark:text-yellow-400",
					buttonBg: "bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300"
				};
			case "info":
				return {
					iconBg: "bg-blue-100 dark:bg-blue-900/20",
					iconColor: "text-blue-600 dark:text-blue-400",
					buttonBg: "bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300"
				};
			default:
				return {
					iconBg: "bg-red-100 dark:bg-red-900/20",
					iconColor: "text-red-600 dark:text-red-400",
					buttonBg: "bg-red-500 hover:bg-red-600 disabled:bg-red-300"
				};
		}
	};

	const styles = getVariantStyles();

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="relative w-full max-w-md m-5 sm:m-0 rounded-3xl bg-white p-6 dark:bg-gray-900"
		>
			<div className="text-center">
				{/* Icon */}
				<div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg} mb-4`}>
					{icon && (
						<div className={styles.iconColor}>
							{icon}
						</div>
					)}
				</div>

				{/* Title */}
				<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
					{title}
				</h3>

				{/* Message */}
				<p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
					{message}
				</p>

				{/* Action buttons */}
				<div className="flex gap-3">
					<Button
						variant="outline"
						onClick={onClose}
						disabled={isLoading}
						className="flex-1"
					>
						{cancelText}
					</Button>
					<Button
						variant="primary"
						onClick={onConfirm}
						disabled={isLoading}
						className={`flex-1 ${styles.buttonBg}`}
					>
						{isLoading ? "Processing..." : confirmText}
					</Button>
				</div>
			</div>
		</Modal>
	);
}
