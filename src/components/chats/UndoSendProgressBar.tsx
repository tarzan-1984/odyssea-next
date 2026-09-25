"use client";

import React, { useEffect, useRef } from "react";

type Props = {
	createdAt: string;
	scheduledSendAt?: string;
	className?: string;
};

function getTiming(createdAt: string, scheduledSendAt?: string, now = Date.now()) {
	if (!scheduledSendAt) {
		return { progress: 0, remainingMs: 0 };
	}
	const start = new Date(createdAt).getTime();
	const end = new Date(scheduledSendAt).getTime();
	const total = end - start;
	if (!Number.isFinite(total) || total <= 0) {
		return { progress: 0, remainingMs: 0 };
	}
	const remainingMs = Math.max(0, end - now);
	return {
		progress: Math.min(1, Math.max(0, remainingMs / total)),
		remainingMs,
	};
}

/** Smooth depleting bar via a single CSS transform transition. */
export default function UndoSendProgressBar({ createdAt, scheduledSendAt, className }: Props) {
	const fillRef = useRef<HTMLDivElement>(null);
	const initial = getTiming(createdAt, scheduledSendAt);

	useEffect(() => {
		const fill = fillRef.current;
		if (!fill) return;

		const { progress, remainingMs } = getTiming(createdAt, scheduledSendAt);

		fill.style.transition = "none";
		fill.style.transform = `scaleX(${progress})`;
		void fill.offsetWidth;

		if (remainingMs <= 0) {
			fill.style.transform = "scaleX(0)";
			return;
		}

		fill.style.transition = `transform ${remainingMs}ms linear`;
		fill.style.transform = "scaleX(0)";

		return () => {
			fill.style.transition = "none";
		};
	}, [createdAt, scheduledSendAt]);

	return (
		<div
			className={`h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 ${className ?? ""}`}
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(initial.progress * 100)}
			aria-label="Time remaining before send"
		>
			<div
				ref={fillRef}
				className="h-full w-full origin-left rounded-full bg-brand-500 will-change-transform"
				style={{ transform: `scaleX(${initial.progress})` }}
			/>
		</div>
	);
}
