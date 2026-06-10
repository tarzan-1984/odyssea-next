import type { PixelCrop } from "react-image-crop";
import { isHeicFileName, toJpegDownloadFilename } from "@/utils/downloadChatFile";
import { HEIC_PREVIEW_CONVERT_ENABLED, getHeicConvertPreviewUrl } from "@/config/heicPreviewConvert";

export type CanvasEditSnapshot = {
	imageData: ImageData;
	width: number;
	height: number;
	isGrayscale: boolean;
};

export function captureCanvasEditSnapshot(
	canvas: HTMLCanvasElement,
	isGrayscale: boolean
): CanvasEditSnapshot | null {
	const ctx = canvas.getContext("2d");
	if (!ctx || canvas.width === 0 || canvas.height === 0) return null;

	return {
		imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
		width: canvas.width,
		height: canvas.height,
		isGrayscale,
	};
}

export function restoreCanvasEditSnapshot(
	canvas: HTMLCanvasElement,
	snapshot: CanvasEditSnapshot
): void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	if (canvas.width !== snapshot.width || canvas.height !== snapshot.height) {
		canvas.width = snapshot.width;
		canvas.height = snapshot.height;
	}

	ctx.putImageData(snapshot.imageData, 0, 0);
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", reject);
		image.src = src;
	});
}

export function createCanvasFromImage(image: HTMLImageElement): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas is not supported");
	}
	ctx.drawImage(image, 0, 0);
	return canvas;
}

/** Rotate canvas pixels 90° clockwise (+90) or counter-clockwise (-90). */
export function rotateCanvas(canvas: HTMLCanvasElement, degrees: 90 | -90): void {
	const ctx = canvas.getContext("2d");
	if (!ctx || canvas.width === 0 || canvas.height === 0) return;

	const { width, height } = canvas;
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = width;
	tempCanvas.height = height;
	const tempCtx = tempCanvas.getContext("2d");
	if (!tempCtx) return;
	tempCtx.drawImage(canvas, 0, 0);

	canvas.width = height;
	canvas.height = width;
	const nextCtx = canvas.getContext("2d");
	if (!nextCtx) return;

	if (degrees === 90) {
		nextCtx.translate(canvas.width, 0);
		nextCtx.rotate(Math.PI / 2);
	} else {
		nextCtx.translate(0, canvas.height);
		nextCtx.rotate(-Math.PI / 2);
	}
	nextCtx.drawImage(tempCanvas, 0, 0);
}

function luminance(r: number, g: number, b: number): number {
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp255(value: number): number {
	return Math.min(255, Math.max(0, Math.round(value)));
}

function percentileFromHistogram(hist: Uint32Array, percentile: number): number {
	let total = 0;
	for (let i = 0; i < 256; i++) total += hist[i];
	if (total === 0) return 240;

	const target = total * Math.min(1, Math.max(0, percentile));
	let acc = 0;
	for (let i = 0; i < 256; i++) {
		acc += hist[i];
		if (acc >= target) return i;
	}
	return 255;
}

function smoothstep01(t: number): number {
	const x = Math.min(1, Math.max(0, t));
	return x * x * (3 - 2 * x);
}

/** Soften grain on bright paper areas before whitening. */
function softenBrightPaperGrain(
	values: Float32Array,
	width: number,
	height: number,
	threshold: number
): void {
	const source = new Float32Array(values);
	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const p = y * width + x;
			if (source[p] < threshold) continue;

			let sum = 0;
			let count = 0;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					const v = source[(y + dy) * width + (x + dx)];
					if (v >= threshold - 20) {
						sum += v;
						count++;
					}
				}
			}
			if (count > 0) {
				values[p] = sum / count;
			}
		}
	}
}

export type RgbColor = { r: number; g: number; b: number };

export function rgbToHex({ r, g, b }: RgbColor): string {
	return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgb(hex: string): RgbColor | null {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!match) return null;
	return {
		r: parseInt(match[1], 16),
		g: parseInt(match[2], 16),
		b: parseInt(match[3], 16),
	};
}

export function getCanvasPixelColor(
	canvas: HTMLCanvasElement,
	x: number,
	y: number
): RgbColor {
	const ctx = canvas.getContext("2d");
	if (!ctx) return { r: 248, g: 248, b: 248 };

	const px = Math.min(canvas.width - 1, Math.max(0, Math.floor(x)));
	const py = Math.min(canvas.height - 1, Math.max(0, Math.floor(y)));
	const data = ctx.getImageData(px, py, 1, 1).data;
	return { r: data[0], g: data[1], b: data[2] };
}

/** Sample paper tone from bright pixels around the brush (not under the stroke). */
export function sampleLocalPaperColor(
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
	brushRadius: number
): { r: number; g: number; b: number } {
	const ctx = canvas.getContext("2d");
	if (!ctx) return { r: 248, g: 248, b: 248 };

	const inner = Math.max(4, brushRadius * 0.55);
	const outer = brushRadius + 18;
	const cx = Math.floor(x);
	const cy = Math.floor(y);
	const x0 = Math.max(0, Math.floor(cx - outer));
	const y0 = Math.max(0, Math.floor(cy - outer));
	const x1 = Math.min(canvas.width, Math.ceil(cx + outer));
	const y1 = Math.min(canvas.height, Math.ceil(cy + outer));
	const w = x1 - x0;
	const h = y1 - y0;
	if (w <= 0 || h <= 0) return { r: 248, g: 248, b: 248 };

	const pixels = ctx.getImageData(x0, y0, w, h).data;
	const samplesR: number[] = [];
	const samplesG: number[] = [];
	const samplesB: number[] = [];

	for (let py = 0; py < h; py++) {
		for (let px = 0; px < w; px++) {
			const worldX = x0 + px;
			const worldY = y0 + py;
			const dist = Math.hypot(worldX - x, worldY - y);
			if (dist < inner || dist > outer) continue;

			const i = (py * w + px) * 4;
			const r = pixels[i];
			const g = pixels[i + 1];
			const b = pixels[i + 2];
			if (luminance(r, g, b) >= 165) {
				samplesR.push(r);
				samplesG.push(g);
				samplesB.push(b);
			}
		}
	}

	if (samplesR.length === 0) return { r: 248, g: 248, b: 248 };

	samplesR.sort((a, b) => a - b);
	samplesG.sort((a, b) => a - b);
	samplesB.sort((a, b) => a - b);
	const idx = Math.floor(samplesR.length * 0.72);

	return {
		r: clamp255(samplesR[idx]),
		g: clamp255(samplesG[idx]),
		b: clamp255(samplesB[idx]),
	};
}

/** @deprecated Use sampleLocalPaperColor for color-accurate erasing. */
export function sampleLocalPaperGray(
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
	brushRadius: number
): number {
	const { r, g, b } = sampleLocalPaperColor(canvas, x, y, brushRadius);
	return clamp255(luminance(r, g, b));
}

/**
 * Document B&W: true desaturate + contrast + uniform neutral paper.
 * Returns typical paper gray for eraser fallback.
 */
export function applyDocumentGrayscaleToCanvas(canvas: HTMLCanvasElement): number {
	const ctx = canvas.getContext("2d");
	if (!ctx) return 248;

	const { width, height } = canvas;

	const filtered = document.createElement("canvas");
	filtered.width = width;
	filtered.height = height;
	const fctx = filtered.getContext("2d");
	if (!fctx) return 248;

	fctx.filter = "grayscale(100%) contrast(1.14) brightness(1.08)";
	fctx.drawImage(canvas, 0, 0, width, height);
	ctx.clearRect(0, 0, width, height);
	ctx.drawImage(filtered, 0, 0);

	const imageData = ctx.getImageData(0, 0, width, height);
	const { data } = imageData;
	const pixelCount = width * height;
	const grays = new Uint8Array(pixelCount);

	for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
		grays[p] = data[i];
	}

	const hist = new Uint32Array(256);
	for (let p = 0; p < pixelCount; p++) {
		hist[grays[p]]++;
	}

	const blackPoint = percentileFromHistogram(hist, 0.04);
	const whitePoint = percentileFromHistogram(hist, 0.99);
	const stretchRange = Math.max(1, whitePoint - blackPoint);
	const stretched = new Float32Array(pixelCount);

	for (let p = 0; p < pixelCount; p++) {
		stretched[p] = ((grays[p] - blackPoint) / stretchRange) * 255;
	}

	softenBrightPaperGrain(stretched, width, height, 175);

	const paperOutput = 248;
	const paperStart = 168;
	const brightAfter: number[] = [];

	for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
		let g = stretched[p];

		if (g >= paperStart) {
			const blend = smoothstep01((g - paperStart) / (255 - paperStart));
			g = g + (paperOutput - g) * blend;
			if (g >= paperOutput - 4) {
				g = paperOutput;
			}
		} else if (g < 150) {
			g = Math.pow(Math.max(0, g) / 150, 0.96) * 150;
		}

		const out = clamp255(g);
		data[i] = out;
		data[i + 1] = out;
		data[i + 2] = out;
		if (out >= 215) brightAfter.push(out);
	}

	ctx.putImageData(imageData, 0, 0);

	if (brightAfter.length === 0) return paperOutput;
	brightAfter.sort((a, b) => a - b);
	return clamp255(brightAfter[Math.floor(brightAfter.length * 0.55)]);
}

/** @deprecated Use applyDocumentGrayscaleToCanvas for document editing. */
export function applyGrayscaleToCanvas(canvas: HTMLCanvasElement): void {
	applyDocumentGrayscaleToCanvas(canvas);
}

export function eraseOnCanvas(
	canvas: HTMLCanvasElement,
	x: number,
	y: number,
	radius: number,
	fillColor?: { r: number; g: number; b: number }
): void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const color = fillColor ?? sampleLocalPaperColor(canvas, x, y, radius);
	ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
}

export function getCanvasPointFromPointer(
	canvas: HTMLCanvasElement,
	clientX: number,
	clientY: number
): { x: number; y: number } {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;
	return {
		x: (clientX - rect.left) * scaleX,
		y: (clientY - rect.top) * scaleY,
	};
}

export async function getCroppedImageBlobFromElement(
	image: HTMLImageElement,
	pixelCrop: PixelCrop,
	mimeType = "image/jpeg",
	quality = 0.92
): Promise<Blob> {
	if (!pixelCrop.width || !pixelCrop.height) {
		throw new Error("Crop area is empty");
	}

	const scaleX = image.naturalWidth / image.width;
	const scaleY = image.naturalHeight / image.height;

	const canvas = document.createElement("canvas");
	canvas.width = Math.floor(pixelCrop.width * scaleX);
	canvas.height = Math.floor(pixelCrop.height * scaleY);

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas is not supported");
	}

	ctx.drawImage(
		image,
		pixelCrop.x * scaleX,
		pixelCrop.y * scaleY,
		pixelCrop.width * scaleX,
		pixelCrop.height * scaleY,
		0,
		0,
		canvas.width,
		canvas.height
	);

	return canvasToBlob(canvas, mimeType, quality);
}

export async function replaceCanvasFromBlob(
	canvas: HTMLCanvasElement,
	blob: Blob
): Promise<void> {
	const url = URL.createObjectURL(blob);
	try {
		const image = await loadImageElement(url);
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Canvas is not supported");
		}
		ctx.drawImage(image, 0, 0);
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType = "image/jpeg",
	quality = 0.92
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			blob => {
				if (!blob) {
					reject(new Error("Failed to export image"));
					return;
				}
				resolve(blob);
			},
			mimeType,
			quality
		);
	});
}

export async function canvasToPdfBlob(
	canvas: HTMLCanvasElement,
	jpegQuality = 0.92
): Promise<Blob> {
	const width = canvas.width;
	const height = canvas.height;
	if (!width || !height) {
		throw new Error("Canvas is empty");
	}

	const { jsPDF } = await import("jspdf");
	const pdf = new jsPDF({
		orientation: width >= height ? "landscape" : "portrait",
		unit: "px",
		format: [width, height],
		hotfixes: ["px_scaling"],
	});

	const dataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
	pdf.addImage(dataUrl, "JPEG", 0, 0, width, height, undefined, "FAST");
	return pdf.output("blob");
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement): string {
	return canvas.toDataURL("image/jpeg", 0.92);
}

function resolveCropSourceUrl(fileUrl: string, fileName: string): string {
	if (isHeicFileName(fileName, fileUrl)) {
		const converted = getHeicConvertPreviewUrl(fileUrl);
		if (converted) {
			return converted;
		}
		if (!HEIC_PREVIEW_CONVERT_ENABLED) {
			throw new Error("HEIC preview conversion is disabled");
		}
	}
	return `/api/storage/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
}

export async function loadChatImageBlobUrl(
	fileUrl: string,
	fileName: string
): Promise<string> {
	const response = await fetch(resolveCropSourceUrl(fileUrl, fileName), {
		credentials: "include",
		cache: "no-store",
	});
	if (!response.ok) {
		throw new Error("Failed to load image for editing");
	}
	const blob = await response.blob();
	return URL.createObjectURL(blob);
}

export function editedDownloadFilename(fileName: string): string {
	const base = (fileName || "image").trim();
	if (isHeicFileName(base)) {
		const jpegBase = toJpegDownloadFilename(base).replace(/(\.jpe?g)$/i, "");
		return `${jpegBase}-edited.pdf`;
	}
	const dot = base.lastIndexOf(".");
	const name = dot <= 0 ? base : base.slice(0, dot);
	return `${name}-edited.pdf`;
}

export function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
