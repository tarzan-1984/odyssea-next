"use client";

import React from "react";
import {
	UNDO_SEND_DELAY_MAX_SECONDS,
	UNDO_SEND_DELAY_MIN_SECONDS,
	formatUndoSendDelayLabel,
} from "@/constants/undoSendDelay";
import { useUndoSendDelayStore } from "@/stores/undoSendDelayStore";

export default function UndoSendDelaySettings() {
	const delaySeconds = useUndoSendDelayStore(s => s.delaySeconds);
	const setDelaySeconds = useUndoSendDelayStore(s => s.setDelaySeconds);

	return (
		<div className="min-w-0 rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
			<div className="mb-4 min-w-0">
				<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
					Undo send
				</h4>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					Delay before a chat message is actually sent so you can cancel it. 0 seconds
					disables the feature. Saved in this browser.
				</p>
			</div>

			<div className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-700">
				<div className="mb-2 flex items-baseline justify-between gap-2">
					<p className="text-sm font-medium text-gray-800 dark:text-white/90">
						Cancellation window
					</p>
					<p className="shrink-0 text-xs font-medium text-gray-700 dark:text-gray-300">
						{formatUndoSendDelayLabel(delaySeconds)}
					</p>
				</div>
				<input
					type="range"
					min={UNDO_SEND_DELAY_MIN_SECONDS}
					max={UNDO_SEND_DELAY_MAX_SECONDS}
					step={1}
					value={delaySeconds}
					onChange={e => setDelaySeconds(Number(e.target.value))}
					className="w-full accent-brand-500"
					aria-label="Undo send delay in seconds"
				/>
				<div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
					<span>Off</span>
					<span>15s</span>
					<span>30s</span>
				</div>
			</div>
		</div>
	);
}
