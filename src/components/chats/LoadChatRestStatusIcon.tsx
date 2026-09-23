"use client";

import { useEffect, useState } from "react";
import { LoadRestIcon, LoadTurnOnIcon } from "@/icons";
import {
	formatRestCountdown,
	remainingRestMs,
	restCountdownTone,
} from "@/utils/restCountdown";

type LoadChatRestStatusIconProps = {
	isRest?: boolean;
	restDate?: string | null;
	restStartedAt?: string | null;
	onClick?: () => void;
	className?: string;
};

const TONE_CLASS: Record<"green" | "yellow" | "red", string> = {
	green: "text-emerald-500 dark:text-emerald-400",
	yellow: "text-amber-400 dark:text-amber-300",
	red: "text-red-500 dark:text-red-400",
};

/** Rest / on-duty icon under the LOAD chat header avatar. */
export default function LoadChatRestStatusIcon({
	isRest = false,
	restDate = null,
	restStartedAt = null,
	onClick,
	className,
}: LoadChatRestStatusIconProps) {
	const [now, setNow] = useState(() => Date.now());
	const remainingMs = remainingRestMs(restDate, now);
	const showCountdown = Boolean(isRest && restDate && remainingMs > 0);

	useEffect(() => {
		if (!isRest || !restDate) return;
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, [isRest, restDate]);

	const countdown = formatRestCountdown(remainingMs);
	const toneClass = TONE_CLASS[restCountdownTone(remainingMs, restDate, restStartedAt)];

	const icon = isRest ? (
		<LoadRestIcon className="h-6 w-7 text-brand-600 dark:text-brand-400" />
	) : (
		<LoadTurnOnIcon className="h-7 w-7" />
	);
	const wrapClass =
		className ??
		"mt-2.5 flex flex-col items-center justify-center rounded-full";

	const body = (
		<>
			<span className="flex h-7 w-7 items-center justify-center">{icon}</span>
			{showCountdown ? (
				<span
					className={`mt-0.5 font-mono text-[10px] leading-none tabular-nums ${toneClass}`}
				>
					{countdown}
				</span>
			) : null}
		</>
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				className={`${wrapClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400`}
				title={isRest ? "Rest state" : "Set rest state"}
				aria-label={isRest ? "Rest state" : "Set rest state"}
			>
				{body}
			</button>
		);
	}

	return (
		<span className={wrapClass} title={isRest ? "Rest" : "On"} aria-label={isRest ? "Rest" : "On"}>
			{body}
		</span>
	);
}
