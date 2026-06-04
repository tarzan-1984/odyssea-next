"use client";

import React from "react";
import {
	CHAT_FONT_BASE_PX,
	CHAT_FONT_SCALE_MAX,
	CHAT_FONT_SCALE_MIN,
	chatFontScaleToPercent,
	isDefaultChatFontScales,
	percentToChatFontScale,
	scaledChatFontPx,
} from "@/constants/chatFontSizes";
import { useChatFontSizeStore } from "@/stores/chatFontSizeStore";

type FontScaleRowProps = {
	label: string;
	basePx: number;
	scale: number;
	onChange: (scale: number) => void;
};

function FontScaleRow({ label, basePx, scale, onChange }: FontScaleRowProps) {
	const percent = chatFontScaleToPercent(scale);
	const currentPx = scaledChatFontPx(basePx, scale);

	return (
		<div className="rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-700">
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<p className="text-sm font-medium text-gray-800 dark:text-white/90">{label}</p>
				<p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
					<span className="font-medium text-gray-700 dark:text-gray-300">{currentPx}px</span>
					{" · "}
					{percent}%
					<span className="text-gray-400 dark:text-gray-500">
						{" "}
						(default {basePx}px)
					</span>
				</p>
			</div>
			<input
				type="range"
				min={chatFontScaleToPercent(CHAT_FONT_SCALE_MIN)}
				max={chatFontScaleToPercent(CHAT_FONT_SCALE_MAX)}
				step={1}
				value={percent}
				onChange={e => onChange(percentToChatFontScale(Number(e.target.value)))}
				className="w-full accent-brand-500"
				aria-label={`${label} font size`}
			/>
			<div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
				<span>75%</span>
				<span>100%</span>
				<span>125%</span>
			</div>
		</div>
	);
}

export default function ChatFontSizeSettings() {
	const scales = useChatFontSizeStore(s => s.scales);
	const setScale = useChatFontSizeStore(s => s.setScale);
	const resetScales = useChatFontSizeStore(s => s.resetScales);

	const isDefault = isDefaultChatFontScales(scales);

	return (
		<div className="min-w-0 rounded-2xl border border-gray-200 p-5 dark:border-gray-800 lg:p-6">
			<div className="mb-4 flex items-start justify-between gap-3 min-w-0">
				<div className="min-w-0">
					<h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
						Chat message font
					</h4>
					<p className="text-sm text-gray-500 dark:text-gray-400">
						Adjust each text element separately (±25% from default). Saved in this browser.
					</p>
				</div>
				<button
					type="button"
					onClick={resetScales}
					disabled={isDefault}
					className="shrink-0 text-xs font-semibold text-brand-600 transition hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-brand-400 dark:hover:text-brand-300"
				>
					Reset all
				</button>
			</div>

			<div className="space-y-3">
				<FontScaleRow
					label="Message text"
					basePx={CHAT_FONT_BASE_PX.body}
					scale={scales.body}
					onChange={v => setScale("body", v)}
				/>
				<FontScaleRow
					label="Sender name"
					basePx={CHAT_FONT_BASE_PX.name}
					scale={scales.name}
					onChange={v => setScale("name", v)}
				/>
				<FontScaleRow
					label="Time / role"
					basePx={CHAT_FONT_BASE_PX.meta}
					scale={scales.meta}
					onChange={v => setScale("meta", v)}
				/>
			</div>

			<div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-white/[0.03]">
				<p className="chat-msg-name mb-1.5 font-medium text-gray-800 dark:text-white/90">
					James
				</p>
				<div className="rounded-lg rounded-tl-sm bg-gray-100 px-3 py-2 text-gray-800 dark:bg-white/5 dark:text-white/90">
					<p className="chat-msg-body whitespace-pre-line">
						Hello, it&apos;s James from Odysseia.
						{"\n"}Shipper: Example Co
					</p>
				</div>
				<p className="chat-msg-meta mt-2 text-gray-500 dark:text-gray-400">
					Driver, 2:30 PM
				</p>
			</div>
		</div>
	);
}
