"use client";

import React from "react";
import { hexToRgb, rgbToHex, type RgbColor } from "@/utils/chatImageEditor";

function EyedropperIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 20l4-1 9.5-9.5a2.121 2.121 0 00-3-3L5 16l-1 4zM14 6l4 4"
			/>
		</svg>
	);
}

type ChatEraserSettingsPanelProps = {
	eraserRadius: number;
	eraserColor: RgbColor;
	eraserAutoColor: boolean;
	eraserEyedropperActive: boolean;
	onEraserRadiusChange: (radius: number) => void;
	onEraserColorChange: (hex: string) => void;
	onToggleEraserEyedropper: () => void;
	onToggleEraserAutoColor: (checked: boolean) => void;
};

export default function ChatEraserSettingsPanel({
	eraserRadius,
	eraserColor,
	eraserAutoColor,
	eraserEyedropperActive,
	onEraserRadiusChange,
	onEraserColorChange,
	onToggleEraserEyedropper,
	onToggleEraserAutoColor,
}: ChatEraserSettingsPanelProps) {
	return (
		<div className="flex w-48 flex-col gap-3 rounded-xl bg-black/60 p-3 ring-1 ring-white/30">
			<div>
				<div className="flex items-center justify-between gap-2">
					<label className="text-xs font-medium text-white" htmlFor="eraser-size">
						Eraser size
					</label>
					<span className="text-xs tabular-nums text-gray-300">{eraserRadius * 2}px</span>
				</div>
				<input
					id="eraser-size"
					type="range"
					min={8}
					max={80}
					value={eraserRadius}
					onChange={e => onEraserRadiusChange(Number(e.target.value))}
					className="mt-1.5 w-full accent-brand-500"
				/>
			</div>
			<div>
				<span className="text-xs font-medium text-white">Eraser color</span>
				<div className="mt-1.5 flex items-center gap-2">
					<input
						type="color"
						value={rgbToHex(eraserColor)}
						disabled={eraserAutoColor}
						onChange={e => onEraserColorChange(e.target.value)}
						className="h-8 w-10 shrink-0 cursor-pointer rounded border border-white/30 bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
						title="Pick eraser color"
						aria-label="Pick eraser color"
					/>
					<button
						type="button"
						aria-label="Pick color from image"
						title="Pick color from image"
						onClick={e => {
							e.stopPropagation();
							onToggleEraserEyedropper();
						}}
						className={
							eraserEyedropperActive
								? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white ring-1 ring-brand-400"
								: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60"
						}
					>
						<EyedropperIcon className="h-4 w-4" />
					</button>
					<span
						className="h-8 min-w-0 flex-1 rounded border border-white/20"
						style={{ backgroundColor: rgbToHex(eraserColor) }}
						title={rgbToHex(eraserColor)}
					/>
				</div>
				<label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-gray-200">
					<input
						type="checkbox"
						checked={eraserAutoColor}
						onChange={e => onToggleEraserAutoColor(e.target.checked)}
						className="accent-brand-500"
					/>
					Auto match background
				</label>
				{eraserEyedropperActive ? (
					<p className="mt-1.5 text-[11px] text-brand-300">Click on the image to pick a color</p>
				) : null}
			</div>
		</div>
	);
}
