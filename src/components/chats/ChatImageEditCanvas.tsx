"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	eraseOnCanvas,
	getCanvasPixelColor,
	getCanvasPointFromPointer,
	sampleLocalPaperColor,
	type RgbColor,
} from "@/utils/chatImageEditor";

type ChatImageEditCanvasProps = {
	canvas: HTMLCanvasElement;
	displayScale?: number;
	eraserActive: boolean;
	eraserAutoColor: boolean;
	eraserColor: RgbColor;
	eraserRadius: number;
	eyedropperActive: boolean;
	canvasVersion?: number;
	onStrokeStart?: () => void;
	onStrokeEnd?: () => void;
	onEyedropperPick?: (color: RgbColor) => void;
};

export default function ChatImageEditCanvas({
	canvas,
	displayScale = 1,
	eraserActive,
	eraserAutoColor,
	eraserColor,
	eraserRadius,
	eyedropperActive,
	canvasVersion = 0,
	onStrokeStart,
	onStrokeEnd,
	onEyedropperPick,
}: ChatImageEditCanvasProps) {
	const displayCanvasRef = useRef<HTMLCanvasElement>(null);
	const isDrawingRef = useRef(false);
	const strokeFillColorRef = useRef<RgbColor | null>(null);
	const [brushPreviewPos, setBrushPreviewPos] = useState<{ x: number; y: number } | null>(
		null
	);

	const showBrushPreview = eraserActive && !eyedropperActive;
	const brushDiameterPx = eraserRadius * 2 * displayScale;

	const syncCanvasSize = useCallback(() => {
		const display = displayCanvasRef.current;
		if (!display) return;
		display.width = canvas.width;
		display.height = canvas.height;
		const ctx = display.getContext("2d");
		if (!ctx) return;
		ctx.drawImage(canvas, 0, 0);
	}, [canvas]);

	useEffect(() => {
		syncCanvasSize();
	}, [canvas, syncCanvasSize, canvasVersion]);

	useEffect(() => {
		if (!showBrushPreview) {
			setBrushPreviewPos(null);
		}
	}, [showBrushPreview]);

	const updateBrushPreview = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			if (!showBrushPreview) {
				setBrushPreviewPos(null);
				return;
			}
			const display = displayCanvasRef.current;
			if (!display) return;
			const rect = display.getBoundingClientRect();
			setBrushPreviewPos({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			});
		},
		[showBrushPreview]
	);

	const resolveStrokeColor = useCallback(
		(point: { x: number; y: number }) => {
			if (eraserAutoColor) {
				return sampleLocalPaperColor(canvas, point.x, point.y, eraserRadius);
			}
			return eraserColor;
		},
		[canvas, eraserAutoColor, eraserColor, eraserRadius]
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			updateBrushPreview(e);
			if (!eraserActive) return;
			const display = displayCanvasRef.current;
			if (!display) return;

			const point = getCanvasPointFromPointer(display, e.clientX, e.clientY);

			if (eyedropperActive) {
				onEyedropperPick?.(getCanvasPixelColor(canvas, point.x, point.y));
				return;
			}

			isDrawingRef.current = true;
			display.setPointerCapture(e.pointerId);
			strokeFillColorRef.current = resolveStrokeColor(point);
			onStrokeStart?.();
			eraseOnCanvas(canvas, point.x, point.y, eraserRadius, strokeFillColorRef.current);
			syncCanvasSize();
		},
		[
			canvas,
			eraserActive,
			eraserRadius,
			eyedropperActive,
			onEyedropperPick,
			onStrokeStart,
			resolveStrokeColor,
			syncCanvasSize,
			updateBrushPreview,
		]
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			updateBrushPreview(e);
			if (!eraserActive || eyedropperActive || !isDrawingRef.current) return;
			const display = displayCanvasRef.current;
			if (!display) return;
			const point = getCanvasPointFromPointer(display, e.clientX, e.clientY);
			eraseOnCanvas(
				canvas,
				point.x,
				point.y,
				eraserRadius,
				strokeFillColorRef.current ?? undefined
			);
			syncCanvasSize();
		},
		[canvas, eraserActive, eraserRadius, eyedropperActive, syncCanvasSize, updateBrushPreview]
	);

	const finishStroke = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			if (!isDrawingRef.current) return;
			isDrawingRef.current = false;
			strokeFillColorRef.current = null;
			const display = displayCanvasRef.current;
			if (display?.hasPointerCapture(e.pointerId)) {
				display.releasePointerCapture(e.pointerId);
			}
			onStrokeEnd?.();
		},
		[onStrokeEnd]
	);

	const handlePointerLeave = useCallback(
		(e: React.PointerEvent<HTMLCanvasElement>) => {
			setBrushPreviewPos(null);
			finishStroke(e);
		},
		[finishStroke]
	);

	const canvasCursor = eyedropperActive
		? "cursor-crosshair touch-none"
		: showBrushPreview
			? "cursor-none touch-none"
			: "cursor-default";

	return (
		<div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
			<div className="relative inline-block leading-none">
				<canvas
					ref={displayCanvasRef}
					className={`block max-w-none shrink-0 origin-center object-contain transition-[width,height] duration-200 ease-out ${canvasCursor}`}
					style={{
						width: canvas.width * displayScale,
						height: canvas.height * displayScale,
					}}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={finishStroke}
					onPointerLeave={handlePointerLeave}
					onPointerCancel={handlePointerLeave}
				/>
				{showBrushPreview && brushPreviewPos ? (
					<div
						className="pointer-events-none absolute z-10 rounded-full border border-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.7)]"
						style={{
							left: brushPreviewPos.x,
							top: brushPreviewPos.y,
							width: brushDiameterPx,
							height: brushDiameterPx,
							transform: "translate(-50%, -50%)",
						}}
					/>
				) : null}
			</div>
		</div>
	);
}
