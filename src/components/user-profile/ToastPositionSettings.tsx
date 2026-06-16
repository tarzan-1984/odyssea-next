"use client";

import React, { useCallback } from "react";
import { Check } from "lucide-react";
import {
	DEFAULT_TOAST_POSITION,
	TOAST_POSITION_OPTIONS,
	type ToastPosition,
} from "@/constants/toastNotifications";
import { useToastPositionStore } from "@/stores/toastPositionStore";

const CORNER_LAYOUT: Record<
	ToastPosition,
	{ cornerClass: string; label: string }
> = {
	"top-left": { cornerClass: "left-3 top-3", label: "Top left" },
	"top-right": { cornerClass: "right-3 top-3", label: "Top right" },
	"bottom-left": { cornerClass: "left-3 bottom-3", label: "Bottom left" },
	"bottom-right": { cornerClass: "right-3 bottom-3", label: "Bottom right" },
};

export default function ToastPositionSettings() {
	const position = useToastPositionStore(s => s.position);
	const setPosition = useToastPositionStore(s => s.setPosition);
	const resetPosition = useToastPositionStore(s => s.resetPosition);

	const isDefault = position === DEFAULT_TOAST_POSITION;

	const handlePreview = useCallback(() => {
		if (typeof window === "undefined") return;
		const addSystemToast = (window as Window & {
			addSystemToastNotification?: (notification: {
				id: string;
				title: string;
				message: string;
				variant?: "default";
			}) => void;
		}).addSystemToastNotification;

		addSystemToast?.({
			id: `toast-position-preview-${Date.now()}`,
			title: "Toast preview",
			message: "Notifications will appear in the selected corner.",
			variant: "default",
		});
	}, []);

	return (
		<div className="w-full min-w-0 rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:w-1/2 lg:p-6">
			<div className="mb-4 flex items-start justify-between gap-3 min-w-0">
				<div className="min-w-0">
					<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Toast position
					</h4>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Choose where message notifications appear on screen. Saved in this browser.
					</p>
				</div>
				<button
					type="button"
					onClick={resetPosition}
					disabled={isDefault}
					className="shrink-0 text-xs font-semibold text-brand-600 transition hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:hover:text-brand-300"
				>
					Reset
				</button>
			</div>

			<div className="relative aspect-[16/9] w-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-white/[0.02]">
				<div className="absolute inset-x-4 top-4 h-8 rounded-lg border border-gray-200 bg-white/80 dark:border-gray-700 dark:bg-gray-900/60" />
				<p className="absolute left-1/2 top-[1.35rem] -translate-x-1/2 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
					Header
				</p>

				{(TOAST_POSITION_OPTIONS.map(option => option.value) as ToastPosition[]).map(
					value => {
						const isSelected = position === value;
						const layout = CORNER_LAYOUT[value];

						return (
							<button
								key={value}
								type="button"
								onClick={() => setPosition(value)}
								className={`absolute ${layout.cornerClass} flex max-w-[42%] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors sm:max-w-[38%] sm:px-3 sm:py-2.5 ${
									isSelected
										? "border-brand-500 bg-brand-500/10 shadow-sm dark:border-brand-500/80"
										: "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
								}`}
								aria-pressed={isSelected}
								aria-label={layout.label}
							>
								<span
									className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border sm:h-5 sm:w-5 ${
										isSelected
											? "border-brand-500 bg-brand-500 text-white"
											: "border-gray-300 dark:border-gray-600"
									}`}
								>
									{isSelected ? (
										<Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden />
									) : null}
								</span>
								<span className="min-w-0 text-[11px] font-medium leading-tight text-gray-800 dark:text-white/90 sm:text-xs">
									{layout.label}
								</span>
							</button>
						);
					}
				)}
			</div>

			<p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
				{
					TOAST_POSITION_OPTIONS.find(option => option.value === position)
						?.description
				}
			</p>

			<div className="mt-4">
				<button
					type="button"
					onClick={handlePreview}
					className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
				>
					Preview toast
				</button>
			</div>
		</div>
	);
}
