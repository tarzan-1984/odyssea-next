"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { centerCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Modal } from "@/components/ui/modal";
import { HeicConvertingOverlay } from "@/components/chats/HeicConvertingOverlay";
import ChatImageEditCanvas from "@/components/chats/ChatImageEditCanvas";
import type { ChatGalleryImage } from "@/utils/chatGalleryImages";
import { isChatImageFileName } from "@/utils/chatGalleryImages";
import {
	applyDocumentGrayscaleToCanvas,
	canvasToPdfBlob,
	canvasToObjectUrl,
	captureCanvasEditSnapshot,
	createCanvasFromImage,
	downloadBlob,
	editedDownloadFilename,
	getCroppedImageBlobFromElement,
	hexToRgb,
	loadChatImageBlobUrl,
	loadImageElement,
	replaceCanvasFromBlob,
	restoreCanvasEditSnapshot,
	rgbToHex,
	type CanvasEditSnapshot,
	type RgbColor,
} from "@/utils/chatImageEditor";

const MODAL_IMAGE_ZOOM_MAX = 5;
const MODAL_IMAGE_ZOOM_STEP = 1.25;
const MODAL_IMAGE_BOTTOM_CHROME_PX = 72;
const DEFAULT_ERASER_RADIUS = 28;
const DEFAULT_ERASER_COLOR: RgbColor = { r: 248, g: 248, b: 248 };
const MAX_EDIT_UNDO_STEPS = 30;

type ViewMode = "preview" | "edit";
type EditSubTool = "none" | "crop" | "eraser";

function computeModalFitScale(
	naturalW: number,
	naturalH: number,
	viewportW: number,
	viewportH: number,
	rotationDeg: number
): number {
	if (!naturalW || !naturalH || !viewportW || !viewportH) return 1;
	const rot = ((rotationDeg % 360) + 360) % 360;
	const swapped = rot === 90 || rot === 270;
	const effW = swapped ? naturalH : naturalW;
	const effH = swapped ? naturalW : naturalH;
	return Math.min(viewportW / effW, viewportH / effH, 1);
}

function resolveImagePreviewUrl(fileUrl: string, fileName: string): string {
	const ext = fileName.toLowerCase().split(".").pop();
	if (ext === "heic" || ext === "heif") {
		return `/api/storage/convert-heic?url=${encodeURIComponent(fileUrl)}`;
	}
	return fileUrl;
}

function ChevronLeftIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
		</svg>
	);
}

function ChevronRightIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	);
}

function EditIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"
			/>
		</svg>
	);
}

function CropIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M6 2v4M2 6h4M18 22v-4M22 18h-4M8 8H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2M16 16h2a2 2 0 002-2V6a2 2 0 00-2-2h-10a2 2 0 00-2 2v2"
			/>
		</svg>
	);
}

function GrayscaleIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<circle cx="12" cy="12" r="9" strokeWidth={2} />
			<path strokeLinecap="round" strokeWidth={2} d="M12 3v18" />
			<path strokeLinecap="round" strokeWidth={2} d="M12 3a9 9 0 019 9" fill="currentColor" fillOpacity={0.35} />
		</svg>
	);
}

function EraserIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M7 21h10M12 3l8.485 8.485a2 2 0 010 2.828L11.657 23.071a2 2 0 01-2.828 0L3 15.243a2 2 0 010-2.828L12 3z"
			/>
		</svg>
	);
}

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

function SaveIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
			/>
		</svg>
	);
}

type ChatImageLightboxProps = {
	isOpen: boolean;
	images: ChatGalleryImage[];
	currentIndex: number;
	onClose: () => void;
	onPrev: () => void;
	onNext: () => void;
};

export default function ChatImageLightbox({
	isOpen,
	images,
	currentIndex,
	onClose,
	onPrev,
	onNext,
}: ChatImageLightboxProps) {
	const current = images[currentIndex];
	const [previewUrl, setPreviewUrl] = useState("");
	const [isModalImageLoading, setIsModalImageLoading] = useState(false);
	const [modalImageScale, setModalImageScale] = useState(1);
	const [modalImgNaturalSize, setModalImgNaturalSize] = useState<{
		w: number;
		h: number;
	} | null>(null);

	const [viewMode, setViewMode] = useState<ViewMode>("preview");
	const [editSubTool, setEditSubTool] = useState<EditSubTool>("none");
	const [isGrayscale, setIsGrayscale] = useState(false);
	const [isEditBusy, setIsEditBusy] = useState(false);
	const [editCanvasVersion, setEditCanvasVersion] = useState(0);
	const [eraserRadius, setEraserRadius] = useState(DEFAULT_ERASER_RADIUS);
	const [eraserColor, setEraserColor] = useState<RgbColor>(DEFAULT_ERASER_COLOR);
	const [eraserAutoColor, setEraserAutoColor] = useState(true);
	const [eraserEyedropperActive, setEraserEyedropperActive] = useState(false);

	const [crop, setCrop] = useState<Crop>();
	const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
	const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);

	const modalScrollViewportRef = useRef<HTMLDivElement>(null);
	const modalFitScaleRef = useRef(1);
	const editCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const colorBeforeGrayscaleRef = useRef<ImageData | null>(null);
	const cropSourceUrlRef = useRef<string | null>(null);
	const cropImgRef = useRef<HTMLImageElement>(null);
	const undoStackRef = useRef<CanvasEditSnapshot[]>([]);
	const isGrayscaleRef = useRef(false);

	const hasPrev = currentIndex > 0;
	const hasNext = currentIndex < images.length - 1;
	const fileExtension = current?.fileName.toLowerCase().split(".").pop();
	const isHeic = fileExtension === "heic" || fileExtension === "heif";
	const isEditing = viewMode === "edit";
	const isCropMode = isEditing && editSubTool === "crop";
	const isEraserMode = isEditing && editSubTool === "eraser";

	useEffect(() => {
		isGrayscaleRef.current = isGrayscale;
	}, [isGrayscale]);

	const bumpEditCanvas = useCallback(() => {
		setEditCanvasVersion(v => v + 1);
	}, []);

	const revokeCropSourceUrl = useCallback(() => {
		if (cropSourceUrlRef.current?.startsWith("blob:")) {
			URL.revokeObjectURL(cropSourceUrlRef.current);
		}
		cropSourceUrlRef.current = null;
		setCropSourceUrl(null);
	}, []);

	const pushUndoSnapshot = useCallback(() => {
		const canvas = editCanvasRef.current;
		if (!canvas) return;
		const snapshot = captureCanvasEditSnapshot(canvas, isGrayscaleRef.current);
		if (!snapshot) return;

		const stack = undoStackRef.current;
		stack.push(snapshot);
		if (stack.length > MAX_EDIT_UNDO_STEPS) {
			stack.shift();
		}
	}, []);

	const handleUndoEdit = useCallback(() => {
		if (isCropMode || isEditBusy) return;

		const stack = undoStackRef.current;
		if (stack.length === 0) return;

		const canvas = editCanvasRef.current;
		const snapshot = stack.pop();
		if (!canvas || !snapshot) return;

		restoreCanvasEditSnapshot(canvas, snapshot);
		colorBeforeGrayscaleRef.current = null;
		setIsGrayscale(snapshot.isGrayscale);
		setEditSubTool(prev => (prev === "eraser" ? prev : "none"));
		bumpEditCanvas();
	}, [isCropMode, isEditBusy, bumpEditCanvas]);

	const resetEditState = useCallback(() => {
		revokeCropSourceUrl();
		editCanvasRef.current = null;
		colorBeforeGrayscaleRef.current = null;
		undoStackRef.current = [];
		setViewMode("preview");
		setEditSubTool("none");
		setIsGrayscale(false);
		setIsEditBusy(false);
		setEditCanvasVersion(0);
		setEraserRadius(DEFAULT_ERASER_RADIUS);
		setEraserColor(DEFAULT_ERASER_COLOR);
		setEraserAutoColor(true);
		setEraserEyedropperActive(false);
		setCrop(undefined);
		setCompletedCrop(null);
	}, [revokeCropSourceUrl]);

	const resetView = useCallback(() => {
		setModalImageScale(1);
		setModalImgNaturalSize(null);
		modalFitScaleRef.current = 1;
		resetEditState();
	}, [resetEditState]);

	const applyModalFitToViewport = useCallback((nat: { w: number; h: number }) => {
		const viewport = modalScrollViewportRef.current;
		if (!viewport || !nat.w || !nat.h) return;

		const vw = viewport.clientWidth;
		const vh = Math.max(120, viewport.clientHeight - MODAL_IMAGE_BOTTOM_CHROME_PX);
		const fit = computeModalFitScale(nat.w, nat.h, vw, vh, 0);
		modalFitScaleRef.current = fit;
		setModalImageScale(fit);
	}, []);

	const handleClose = useCallback(() => {
		resetView();
		onClose();
	}, [onClose, resetView]);

	useEffect(() => {
		if (!isOpen || !current) return;
		resetView();
		if (!isChatImageFileName(current.fileName)) return;
		setPreviewUrl(resolveImagePreviewUrl(current.fileUrl, current.fileName));
		if (isHeic) setIsModalImageLoading(true);
	}, [isOpen, current, isHeic, resetView]);

	useEffect(() => {
		if (!isOpen || !modalImgNaturalSize || isEditing) return;
		const frame = requestAnimationFrame(() => {
			applyModalFitToViewport(modalImgNaturalSize);
		});
		return () => cancelAnimationFrame(frame);
	}, [isOpen, modalImgNaturalSize, applyModalFitToViewport, isEditing]);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (isEditing && !isCropMode && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleUndoEdit();
				return;
			}
			if (isEditing) return;
			if (e.key === "ArrowLeft" && hasPrev) {
				e.preventDefault();
				onPrev();
			} else if (e.key === "ArrowRight" && hasNext) {
				e.preventDefault();
				onNext();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isOpen, hasPrev, hasNext, onPrev, onNext, isEditing, isCropMode, handleUndoEdit]);

	const handleStartEdit = useCallback(async () => {
		if (!current || isEditBusy) return;
		setIsEditBusy(true);
		try {
			const blobUrl = await loadChatImageBlobUrl(current.fileUrl, current.fileName);
			const image = await loadImageElement(blobUrl);
			URL.revokeObjectURL(blobUrl);
			editCanvasRef.current = createCanvasFromImage(image);
			colorBeforeGrayscaleRef.current = null;
			undoStackRef.current = [];
			setViewMode("edit");
			setEditSubTool("none");
			setIsGrayscale(false);
			bumpEditCanvas();
		} catch (error) {
			console.error("[ChatImageLightbox] Failed to start edit mode:", error);
		} finally {
			setIsEditBusy(false);
		}
	}, [current, isEditBusy, bumpEditCanvas]);

	const handleExitEdit = useCallback(() => {
		resetEditState();
		setModalImgNaturalSize(null);
		setModalImageScale(1);
	}, [resetEditState]);

	const handleStartCrop = useCallback(() => {
		const canvas = editCanvasRef.current;
		if (!canvas) return;
		revokeCropSourceUrl();
		const dataUrl = canvasToObjectUrl(canvas);
		setCropSourceUrl(dataUrl);
		setEditSubTool("crop");
		setCrop(undefined);
		setCompletedCrop(null);
	}, [revokeCropSourceUrl]);

	const handleCancelCrop = useCallback(() => {
		revokeCropSourceUrl();
		setEditSubTool("none");
		setCrop(undefined);
		setCompletedCrop(null);
	}, [revokeCropSourceUrl]);

	const handleCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
		const { width, height } = e.currentTarget;
		setCrop(centerCrop({ unit: "%", width: 70, height: 70 }, width, height));
		setCompletedCrop(null);
	}, []);

	const handleApplyCrop = useCallback(async () => {
		const canvas = editCanvasRef.current;
		const image = cropImgRef.current;
		if (!canvas || !image || !completedCrop || isEditBusy) return;

		setIsEditBusy(true);
		try {
			pushUndoSnapshot();
			const blob = await getCroppedImageBlobFromElement(image, completedCrop);
			await replaceCanvasFromBlob(canvas, blob);
			if (isGrayscale) {
				colorBeforeGrayscaleRef.current = null;
				applyDocumentGrayscaleToCanvas(canvas);
			} else {
				colorBeforeGrayscaleRef.current = null;
			}
			revokeCropSourceUrl();
			setEditSubTool("none");
			setCrop(undefined);
			setCompletedCrop(null);
			bumpEditCanvas();
		} catch (error) {
			console.error("[ChatImageLightbox] Failed to apply crop:", error);
		} finally {
			setIsEditBusy(false);
		}
	}, [completedCrop, isEditBusy, isGrayscale, revokeCropSourceUrl, bumpEditCanvas, pushUndoSnapshot]);

	const handleToggleGrayscale = useCallback(() => {
		const canvas = editCanvasRef.current;
		if (!canvas || editSubTool === "crop") return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		pushUndoSnapshot();

		if (!isGrayscale) {
			colorBeforeGrayscaleRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
			applyDocumentGrayscaleToCanvas(canvas);
			setIsGrayscale(true);
		} else {
			if (colorBeforeGrayscaleRef.current) {
				ctx.putImageData(colorBeforeGrayscaleRef.current, 0, 0);
			}
			colorBeforeGrayscaleRef.current = null;
			setIsGrayscale(false);
		}
		bumpEditCanvas();
	}, [isGrayscale, editSubTool, bumpEditCanvas, pushUndoSnapshot]);

	const handleEraserStrokeStart = useCallback(() => {
		pushUndoSnapshot();
	}, [pushUndoSnapshot]);

	const handleToggleEraser = useCallback(() => {
		setEditSubTool(prev => {
			if (prev === "eraser") {
				setEraserEyedropperActive(false);
				return "none";
			}
			return "eraser";
		});
	}, []);

	const handleEraserColorChange = useCallback((hex: string) => {
		const rgb = hexToRgb(hex);
		if (!rgb) return;
		setEraserColor(rgb);
		setEraserAutoColor(false);
		setEraserEyedropperActive(false);
	}, []);

	const handleToggleEraserEyedropper = useCallback(() => {
		setEraserEyedropperActive(prev => {
			const next = !prev;
			if (next) setEraserAutoColor(false);
			return next;
		});
	}, []);

	const handleEraserEyedropperPick = useCallback((color: RgbColor) => {
		setEraserColor(color);
		setEraserAutoColor(false);
		setEraserEyedropperActive(false);
	}, []);

	const handleToggleEraserAutoColor = useCallback((checked: boolean) => {
		setEraserAutoColor(checked);
		if (checked) setEraserEyedropperActive(false);
	}, []);

	const handleSaveEdited = useCallback(async () => {
		const canvas = editCanvasRef.current;
		if (!canvas || !current || isEditBusy) return;

		setIsEditBusy(true);
		try {
			const blob = await canvasToPdfBlob(canvas);
			downloadBlob(blob, editedDownloadFilename(current.fileName));
		} catch (error) {
			console.error("[ChatImageLightbox] Failed to save edited image:", error);
		} finally {
			setIsEditBusy(false);
		}
	}, [current, isEditBusy]);

	const handleZoomIn = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setModalImageScale(s => Math.min(MODAL_IMAGE_ZOOM_MAX, s * MODAL_IMAGE_ZOOM_STEP));
	}, []);

	const handleZoomOut = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		const fitScale = modalFitScaleRef.current;
		setModalImageScale(s => Math.max(fitScale, s / MODAL_IMAGE_ZOOM_STEP));
	}, []);

	if (!current) return null;

	const navButtonClass =
		"pointer-events-auto absolute top-1/2 z-[100003] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11";
	const toolButtonClass =
		"flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8";
	const toolTextButtonClass =
		"inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[5rem] sm:text-sm";
	const toolTextButtonActiveClass =
		"inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-md ring-1 ring-brand-400 transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[5rem] sm:text-sm";

	const editCanvas = editCanvasRef.current;
	const zoomScaleAvailable = modalImgNaturalSize !== null || editCanvas !== null;
	const zoomInDisabled =
		!zoomScaleAvailable ||
		modalImageScale * MODAL_IMAGE_ZOOM_STEP > MODAL_IMAGE_ZOOM_MAX + 0.0001;
	const zoomOutDisabled =
		!zoomScaleAvailable ||
		modalImageScale <= modalFitScaleRef.current + 0.0001;

	const zoomControls = (
		<div className="flex flex-row items-center gap-1.5 sm:gap-2">
			<button
				type="button"
				aria-label="Zoom in"
				disabled={zoomInDisabled}
				onClick={handleZoomIn}
				className={toolButtonClass}
			>
				<span className="text-sm font-bold leading-none">+</span>
			</button>
			<button
				type="button"
				aria-label="Zoom out"
				disabled={zoomOutDisabled}
				onClick={handleZoomOut}
				className={toolButtonClass}
			>
				<span className="text-sm font-bold leading-none">−</span>
			</button>
		</div>
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			className="relative flex h-[95vh] w-[95vw] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden !bg-black/90 p-0 shadow-none border-none"
			showCloseButton={true}
			closeButtonClassName="pointer-events-auto absolute right-3 top-3 z-[100003] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 [&_path]:fill-white sm:right-6 sm:top-6 sm:h-11 sm:w-11"
			closeOnBackdropClick={!isEditing}
		>
			<style
				dangerouslySetInnerHTML={{
					__html: `
				.chat-image-lightbox-crop .ReactCrop__crop-selection {
					border: 2px solid rgba(255, 255, 255, 0.95);
					box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
				}
				.chat-image-lightbox-crop .ReactCrop__drag-handle {
					width: 12px;
					height: 12px;
					background: #ffffff;
					border: 2px solid #2563eb;
					border-radius: 2px;
				}
				.chat-image-lightbox-crop .ReactCrop__rule-of-thirds-vt::before,
				.chat-image-lightbox-crop .ReactCrop__rule-of-thirds-vt::after,
				.chat-image-lightbox-crop .ReactCrop__rule-of-thirds-hz::before,
				.chat-image-lightbox-crop .ReactCrop__rule-of-thirds-hz::after {
					background: rgba(255, 255, 255, 0.55);
				}
			`,
				}}
			/>

			<div className="pointer-events-auto absolute left-0 top-3 z-[100003] flex items-start gap-2 px-3 sm:left-3 sm:top-6">
				<div className="flex max-w-[5.5rem] flex-col items-center gap-1.5 sm:max-w-[6.5rem] sm:gap-2">
				{isCropMode ? (
					<>
						{zoomControls}
						<button
							type="button"
							aria-label="Apply crop"
							disabled={!completedCrop?.width || !completedCrop?.height || isEditBusy}
							onClick={e => {
								e.stopPropagation();
								handleApplyCrop().catch(console.error);
							}}
							className={toolTextButtonClass}
						>
							Apply
						</button>
						<button
							type="button"
							aria-label="Cancel crop"
							disabled={isEditBusy}
							onClick={e => {
								e.stopPropagation();
								handleCancelCrop();
							}}
							className={toolTextButtonClass}
						>
							Cancel
						</button>
					</>
				) : isEditing ? (
					<>
						{zoomControls}
						<button
							type="button"
							aria-label="Crop image"
							disabled={isEditBusy || !editCanvas}
							onClick={e => {
								e.stopPropagation();
								handleStartCrop();
							}}
							className={toolTextButtonClass}
							title="Crop"
						>
							<CropIcon className="h-3.5 w-3.5 shrink-0" />
							Crop
						</button>
						<button
							type="button"
							aria-label="Toggle black and white"
							disabled={isEditBusy || !editCanvas}
							onClick={e => {
								e.stopPropagation();
								handleToggleGrayscale();
							}}
							className={isGrayscale ? toolTextButtonActiveClass : toolTextButtonClass}
							title="Black & white"
						>
							<GrayscaleIcon className="h-3.5 w-3.5 shrink-0" />
							B&amp;W
						</button>
						<button
							type="button"
							aria-label="Eraser"
							disabled={isEditBusy || !editCanvas}
							onClick={e => {
								e.stopPropagation();
								handleToggleEraser();
							}}
							className={isEraserMode ? toolTextButtonActiveClass : toolTextButtonClass}
							title="Eraser"
						>
							<EraserIcon className="h-3.5 w-3.5 shrink-0" />
							Eraser
						</button>
						<button
							type="button"
							aria-label="Save edited image"
							disabled={!editCanvas || isEditBusy}
							onClick={e => {
								e.stopPropagation();
								handleSaveEdited().catch(console.error);
							}}
							className={`${toolTextButtonClass} min-w-[4.75rem]`}
							title="Save"
						>
							<SaveIcon className="h-3.5 w-3.5 shrink-0" />
							Save
						</button>
						<button
							type="button"
							aria-label="Exit edit mode"
							disabled={isEditBusy}
							onClick={e => {
								e.stopPropagation();
								handleExitEdit();
							}}
							className={toolTextButtonClass}
						>
							Done
						</button>
					</>
				) : (
					<>
						{zoomControls}
						<button
							type="button"
							aria-label="Edit image"
							disabled={isEditBusy || !previewUrl}
							onClick={e => {
								e.stopPropagation();
								handleStartEdit().catch(console.error);
							}}
							className={`${toolTextButtonClass} min-w-[4.75rem]`}
							title="Edit"
						>
							<EditIcon className="h-3.5 w-3.5 shrink-0" />
							Edit
						</button>
					</>
				)}
				</div>

				{isEraserMode && (
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
								onChange={e => setEraserRadius(Number(e.target.value))}
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
									onChange={e => handleEraserColorChange(e.target.value)}
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
										handleToggleEraserEyedropper();
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
									onChange={e => handleToggleEraserAutoColor(e.target.checked)}
									className="accent-brand-500"
								/>
								Auto match background
							</label>
							{eraserEyedropperActive ? (
								<p className="mt-1.5 text-[11px] text-brand-300">Click on the image to pick a color</p>
							) : null}
						</div>
					</div>
				)}
			</div>

			{images.length > 1 && !isEditing && (
				<>
					<button
						type="button"
						aria-label="Previous image"
						disabled={!hasPrev}
						onClick={e => {
							e.stopPropagation();
							onPrev();
						}}
						className={`${navButtonClass} left-3 sm:left-6`}
					>
						<ChevronLeftIcon className="h-7 w-7" />
					</button>
					<button
						type="button"
						aria-label="Next image"
						disabled={!hasNext}
						onClick={e => {
							e.stopPropagation();
							onNext();
						}}
						className={`${navButtonClass} right-3 sm:right-6`}
					>
						<ChevronRightIcon className="h-7 w-7" />
					</button>
					<div className="pointer-events-none absolute left-1/2 top-4 z-[100003] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/30 sm:top-6">
						{currentIndex + 1} / {images.length}
					</div>
				</>
			)}

			<div ref={modalScrollViewportRef} className="relative min-h-0 flex-1 overflow-auto">
				{isEditBusy && !editCanvas ? <HeicConvertingOverlay variant="modal" /> : null}

				{isCropMode && cropSourceUrl ? (
					<div className="box-border flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
						<ReactCrop
							crop={crop}
							onChange={nextCrop => setCrop(nextCrop)}
							onComplete={pixelCrop => setCompletedCrop(pixelCrop)}
							ruleOfThirds
							keepSelection
							className="chat-image-lightbox-crop"
						>
							<img
								ref={cropImgRef}
								src={cropSourceUrl}
								alt={current.fileName}
								className="block max-w-none object-contain transition-[width,height] duration-200 ease-out"
								style={
									editCanvas
										? {
												width: editCanvas.width * modalImageScale,
												height: editCanvas.height * modalImageScale,
											}
										: undefined
								}
								onLoad={handleCropImageLoad}
							/>
						</ReactCrop>
					</div>
				) : isEditing && editCanvas ? (
					<ChatImageEditCanvas
						key={editCanvasVersion}
						canvas={editCanvas}
						displayScale={modalImageScale}
						eraserActive={isEraserMode}
						eraserAutoColor={eraserAutoColor}
						eraserColor={eraserColor}
						eraserRadius={eraserRadius}
						eyedropperActive={eraserEyedropperActive}
						canvasVersion={editCanvasVersion}
						onStrokeStart={handleEraserStrokeStart}
						onStrokeEnd={bumpEditCanvas}
						onEyedropperPick={handleEraserEyedropperPick}
					/>
				) : (
					<div className="relative box-border flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
						{isModalImageLoading && isHeic ? <HeicConvertingOverlay variant="modal" /> : null}
						{previewUrl ? (
							<img
								key={`${previewUrl}-${currentIndex}`}
								src={previewUrl}
								alt={current.fileName}
								className={`h-auto w-auto shrink-0 origin-center object-contain rounded-lg transition-[width,height] duration-200 ease-out ${
									modalImgNaturalSize ? "max-w-none" : "max-h-[calc(95vh-10rem)] max-w-full"
								}`}
								style={
									modalImgNaturalSize
										? {
												width: modalImgNaturalSize.w * modalImageScale,
												height: modalImgNaturalSize.h * modalImageScale,
											}
										: undefined
								}
								onClick={e => e.stopPropagation()}
								onLoad={e => {
									setIsModalImageLoading(false);
									const target = e.target as HTMLImageElement;
									if (target.naturalWidth && target.naturalHeight) {
										const nat = {
											w: target.naturalWidth,
											h: target.naturalHeight,
										};
										setModalImgNaturalSize(nat);
										requestAnimationFrame(() => {
											applyModalFitToViewport(nat);
										});
									}
								}}
								onError={() => {
									setIsModalImageLoading(false);
									handleClose();
								}}
							/>
						) : (
							<div className="flex h-64 items-center justify-center">
								<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
							</div>
						)}
					</div>
				)}
			</div>

			<div className="pointer-events-none absolute bottom-4 left-1/2 z-[100002] max-w-[calc(100%-2rem)] -translate-x-1/2 transform rounded-lg bg-black/70 px-4 py-2 text-center text-white backdrop-blur-sm">
				<p className="max-w-md truncate text-sm font-medium">{current.fileName}</p>
				<p className="mt-1 text-xs text-gray-300">
					<span>
						{currentIndex + 1} / {images.length}
						{current.fileSize ? " · " : ""}
					</span>
					{current.fileSize ? `${Math.round(current.fileSize / 1024)}KB` : null}
					{isEditing ? " · Editing" : null}
					{isGrayscale ? " · B&W" : null}
					{isEraserMode ? " · Eraser" : null}
					{isEditing ? " · ⌘Z undo" : null}
				</p>
			</div>
		</Modal>
	);
}
