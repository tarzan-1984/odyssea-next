"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { centerCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Modal } from "@/components/ui/modal";
import { HeicConvertingOverlay } from "@/components/chats/HeicConvertingOverlay";
import ChatImageEditCanvas from "@/components/chats/ChatImageEditCanvas";
import ChatEraserSettingsPanel from "@/components/chats/ChatEraserSettingsPanel";
import {
	applyDocumentGrayscaleToCanvas,
	canvasToPdfBlob,
	canvasToObjectUrl,
	captureCanvasEditSnapshot,
	downloadBlob,
	getCroppedImageBlobFromElement,
	hexToRgb,
	replaceCanvasFromBlob,
	restoreCanvasEditSnapshot,
	type CanvasEditSnapshot,
	type RgbColor,
} from "@/utils/chatImageEditor";
import {
	editedPdfPageFilename,
	loadChatPdfBytes,
	openPdfDocument,
	renderPdfPageToCanvas,
} from "@/utils/pdfDocumentEditor";

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
	viewportH: number
): number {
	if (!naturalW || !naturalH || !viewportW || !viewportH) return 1;
	return Math.min(viewportW / naturalW, viewportH / naturalH, 1);
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

function SaveIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
			/>
		</svg>
	);
}

type ChatPdfLightboxProps = {
	isOpen: boolean;
	fileUrl: string;
	fileName: string;
	fileSize?: number;
	onClose: () => void;
};

export default function ChatPdfLightbox({
	isOpen,
	fileUrl,
	fileName,
	fileSize,
	onClose,
}: ChatPdfLightboxProps) {
	const [modalImageScale, setModalImageScale] = useState(1);
	const [modalImgNaturalSize, setModalImgNaturalSize] = useState<{
		w: number;
		h: number;
	} | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("preview");
	const [editSubTool, setEditSubTool] = useState<EditSubTool>("none");
	const [isGrayscale, setIsGrayscale] = useState(false);
	const [isEditBusy, setIsEditBusy] = useState(false);
	const [isPdfLoading, setIsPdfLoading] = useState(false);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [pageCount, setPageCount] = useState(0);
	const [pageIndex, setPageIndex] = useState(0);
	const [pageRenderVersion, setPageRenderVersion] = useState(0);
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
	const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
	const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
	const colorBeforeGrayscaleRef = useRef<ImageData | null>(null);
	const cropSourceUrlRef = useRef<string | null>(null);
	const cropImgRef = useRef<HTMLImageElement>(null);
	const undoStackRef = useRef<CanvasEditSnapshot[]>([]);
	const isGrayscaleRef = useRef(false);

	const isEditing = viewMode === "edit";
	const isCropMode = isEditing && editSubTool === "crop";
	const isEraserMode = isEditing && editSubTool === "eraser";
	const pageCanvas = pageCanvasRef.current;
	const hasPrevPage = pageIndex > 0;
	const hasNextPage = pageIndex < pageCount - 1;

	useEffect(() => {
		isGrayscaleRef.current = isGrayscale;
	}, [isGrayscale]);

	const bumpEditCanvas = useCallback(() => {
		setEditCanvasVersion(v => v + 1);
	}, []);

	const bumpPageRender = useCallback(() => {
		setPageRenderVersion(v => v + 1);
	}, []);

	const revokeCropSourceUrl = useCallback(() => {
		if (cropSourceUrlRef.current?.startsWith("blob:")) {
			URL.revokeObjectURL(cropSourceUrlRef.current);
		}
		cropSourceUrlRef.current = null;
		setCropSourceUrl(null);
	}, []);

	const applyModalFitToViewport = useCallback((nat: { w: number; h: number }) => {
		const viewport = modalScrollViewportRef.current;
		if (!viewport || !nat.w || !nat.h) return;
		const vw = viewport.clientWidth;
		const vh = Math.max(120, viewport.clientHeight - MODAL_IMAGE_BOTTOM_CHROME_PX);
		const fit = computeModalFitScale(nat.w, nat.h, vw, vh);
		modalFitScaleRef.current = fit;
		setModalImageScale(fit);
	}, []);

	const resetEditState = useCallback(() => {
		revokeCropSourceUrl();
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
		pdfDocRef.current = null;
		pageCanvasRef.current = null;
		setPageCount(0);
		setPageIndex(0);
		setPageRenderVersion(0);
		setPdfError(null);
		resetEditState();
	}, [resetEditState]);

	const renderCurrentPage = useCallback(
		async (pdf: PDFDocumentProxy, nextPageIndex: number) => {
			const canvas = await renderPdfPageToCanvas(pdf, nextPageIndex + 1);
			pageCanvasRef.current = canvas;
			const nat = { w: canvas.width, h: canvas.height };
			setModalImgNaturalSize(nat);
			bumpPageRender();
			requestAnimationFrame(() => {
				applyModalFitToViewport(nat);
			});
		},
		[applyModalFitToViewport, bumpPageRender]
	);

	useEffect(() => {
		if (!isOpen) return;
		let cancelled = false;

		const loadPdf = async () => {
			setIsPdfLoading(true);
			setPdfError(null);
			resetView();
			try {
				const bytes = await loadChatPdfBytes(fileUrl, fileName);
				const pdf = await openPdfDocument(bytes);
				if (cancelled) return;
				pdfDocRef.current = pdf;
				setPageCount(pdf.numPages);
				setPageIndex(0);
				await renderCurrentPage(pdf, 0);
			} catch (error) {
				if (cancelled) return;
				console.error("[ChatPdfLightbox] Failed to load PDF:", error);
				setPdfError("Failed to load PDF");
			} finally {
				if (!cancelled) setIsPdfLoading(false);
			}
		};

		loadPdf().catch(error => {
			console.error("[ChatPdfLightbox] Failed to load PDF:", error);
		});
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, fileUrl, fileName]);

	const handleClose = useCallback(() => {
		resetView();
		onClose();
	}, [onClose, resetView]);

	const goPrevPage = useCallback(async () => {
		if (!hasPrevPage || isEditing || !pdfDocRef.current) return;
		const nextIndex = pageIndex - 1;
		setPageIndex(nextIndex);
		setIsPdfLoading(true);
		try {
			await renderCurrentPage(pdfDocRef.current, nextIndex);
		} finally {
			setIsPdfLoading(false);
		}
	}, [hasPrevPage, isEditing, pageIndex, renderCurrentPage]);

	const goNextPage = useCallback(async () => {
		if (!hasNextPage || isEditing || !pdfDocRef.current) return;
		const nextIndex = pageIndex + 1;
		setPageIndex(nextIndex);
		setIsPdfLoading(true);
		try {
			await renderCurrentPage(pdfDocRef.current, nextIndex);
		} finally {
			setIsPdfLoading(false);
		}
	}, [hasNextPage, isEditing, pageIndex, renderCurrentPage]);

	const pushUndoSnapshot = useCallback(() => {
		const canvas = pageCanvasRef.current;
		if (!canvas) return;
		const snapshot = captureCanvasEditSnapshot(canvas, isGrayscaleRef.current);
		if (!snapshot) return;
		const stack = undoStackRef.current;
		stack.push(snapshot);
		if (stack.length > MAX_EDIT_UNDO_STEPS) stack.shift();
	}, []);

	const handleUndoEdit = useCallback(() => {
		if (isCropMode || isEditBusy) return;
		const stack = undoStackRef.current;
		if (stack.length === 0) return;
		const canvas = pageCanvasRef.current;
		const snapshot = stack.pop();
		if (!canvas || !snapshot) return;
		restoreCanvasEditSnapshot(canvas, snapshot);
		colorBeforeGrayscaleRef.current = null;
		setIsGrayscale(snapshot.isGrayscale);
		setEditSubTool(prev => (prev === "eraser" ? prev : "none"));
		bumpEditCanvas();
		bumpPageRender();
	}, [isCropMode, isEditBusy, bumpEditCanvas, bumpPageRender]);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (isEditing && !isCropMode && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
				e.preventDefault();
				handleUndoEdit();
				return;
			}
			if (isEditing) return;
			if (e.key === "ArrowLeft" && hasPrevPage) {
				e.preventDefault();
				goPrevPage().catch(console.error);
			} else if (e.key === "ArrowRight" && hasNextPage) {
				e.preventDefault();
				goNextPage().catch(console.error);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isOpen, isEditing, isCropMode, handleUndoEdit, hasPrevPage, hasNextPage, goPrevPage, goNextPage]);

	const handleStartEdit = useCallback(() => {
		if (!pageCanvasRef.current || isEditBusy) return;
		undoStackRef.current = [];
		colorBeforeGrayscaleRef.current = null;
		setViewMode("edit");
		setEditSubTool("none");
		setIsGrayscale(false);
		bumpEditCanvas();
	}, [isEditBusy, bumpEditCanvas]);

	const handleExitEdit = useCallback(() => {
		resetEditState();
		bumpPageRender();
	}, [resetEditState, bumpPageRender]);

	const handleStartCrop = useCallback(() => {
		const canvas = pageCanvasRef.current;
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
		const canvas = pageCanvasRef.current;
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
			setModalImgNaturalSize({ w: canvas.width, h: canvas.height });
			bumpEditCanvas();
			bumpPageRender();
		} catch (error) {
			console.error("[ChatPdfLightbox] Failed to apply crop:", error);
		} finally {
			setIsEditBusy(false);
		}
	}, [
		completedCrop,
		isEditBusy,
		isGrayscale,
		revokeCropSourceUrl,
		bumpEditCanvas,
		bumpPageRender,
		pushUndoSnapshot,
	]);

	const handleToggleGrayscale = useCallback(() => {
		const canvas = pageCanvasRef.current;
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
		bumpPageRender();
	}, [isGrayscale, editSubTool, bumpEditCanvas, bumpPageRender, pushUndoSnapshot]);

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
		const canvas = pageCanvasRef.current;
		if (!canvas || isEditBusy) return;
		setIsEditBusy(true);
		try {
			const blob = await canvasToPdfBlob(canvas);
			downloadBlob(blob, editedPdfPageFilename(fileName, pageIndex + 1));
		} catch (error) {
			console.error("[ChatPdfLightbox] Failed to save edited PDF page:", error);
		} finally {
			setIsEditBusy(false);
		}
	}, [fileName, isEditBusy, pageIndex]);

	const handleZoomIn = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setModalImageScale(s => Math.min(MODAL_IMAGE_ZOOM_MAX, s * MODAL_IMAGE_ZOOM_STEP));
	}, []);

	const handleZoomOut = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		const fitScale = modalFitScaleRef.current;
		setModalImageScale(s => Math.max(fitScale, s / MODAL_IMAGE_ZOOM_STEP));
	}, []);

	const navButtonClass =
		"pointer-events-auto absolute top-1/2 z-[100003] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11";
	const toolButtonClass =
		"flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8";
	const toolTextButtonClass =
		"inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[5rem] sm:text-sm";
	const toolTextButtonActiveClass =
		"inline-flex min-w-[4.5rem] items-center justify-center gap-1 rounded-full bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-md ring-1 ring-brand-400 transition-colors hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40 sm:min-w-[5rem] sm:text-sm";

	const zoomScaleAvailable = modalImgNaturalSize !== null || pageCanvas !== null;
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
								aria-label="Crop page"
								disabled={isEditBusy || !pageCanvas}
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
								disabled={isEditBusy || !pageCanvas}
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
								disabled={isEditBusy || !pageCanvas}
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
								aria-label="Save edited page"
								disabled={!pageCanvas || isEditBusy}
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
								aria-label="Edit PDF page"
								disabled={isEditBusy || isPdfLoading || !pageCanvas}
								onClick={e => {
									e.stopPropagation();
									handleStartEdit();
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

				{isEraserMode ? (
					<ChatEraserSettingsPanel
						eraserRadius={eraserRadius}
						eraserColor={eraserColor}
						eraserAutoColor={eraserAutoColor}
						eraserEyedropperActive={eraserEyedropperActive}
						onEraserRadiusChange={setEraserRadius}
						onEraserColorChange={handleEraserColorChange}
						onToggleEraserEyedropper={handleToggleEraserEyedropper}
						onToggleEraserAutoColor={handleToggleEraserAutoColor}
					/>
				) : null}
			</div>

			{pageCount > 1 && !isEditing ? (
				<>
					<button
						type="button"
						aria-label="Previous page"
						disabled={!hasPrevPage || isPdfLoading}
						onClick={e => {
							e.stopPropagation();
							goPrevPage().catch(console.error);
						}}
						className={`${navButtonClass} left-3 sm:left-6`}
					>
						<ChevronLeftIcon className="h-7 w-7" />
					</button>
					<button
						type="button"
						aria-label="Next page"
						disabled={!hasNextPage || isPdfLoading}
						onClick={e => {
							e.stopPropagation();
							goNextPage().catch(console.error);
						}}
						className={`${navButtonClass} right-3 sm:right-6`}
					>
						<ChevronRightIcon className="h-7 w-7" />
					</button>
					<div className="pointer-events-none absolute left-1/2 top-4 z-[100003] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white ring-1 ring-white/30 sm:top-6">
						{pageIndex + 1} / {pageCount}
					</div>
				</>
			) : null}

			<div ref={modalScrollViewportRef} className="relative min-h-0 flex-1 overflow-auto">
				{(isPdfLoading && !pageCanvas) || pdfError ? (
					<div className="flex min-h-full items-center justify-center p-8">
						{pdfError ? (
							<p className="text-sm text-red-300">{pdfError}</p>
						) : (
							<HeicConvertingOverlay variant="modal" message="Loading PDF..." />
						)}
					</div>
				) : isCropMode && cropSourceUrl ? (
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
								alt={fileName}
								className="block max-w-none object-contain transition-[width,height] duration-200 ease-out"
								style={
									pageCanvas
										? {
												width: pageCanvas.width * modalImageScale,
												height: pageCanvas.height * modalImageScale,
											}
										: undefined
								}
								onLoad={handleCropImageLoad}
							/>
						</ReactCrop>
					</div>
				) : pageCanvas ? (
					<ChatImageEditCanvas
						key={`${pageRenderVersion}-${editCanvasVersion}-${isEditing ? "edit" : "view"}`}
						canvas={pageCanvas}
						displayScale={modalImageScale}
						eraserActive={isEraserMode}
						eraserAutoColor={eraserAutoColor}
						eraserColor={eraserColor}
						eraserRadius={eraserRadius}
						eyedropperActive={eraserEyedropperActive}
						canvasVersion={pageRenderVersion + editCanvasVersion}
						onStrokeStart={isEraserMode ? handleEraserStrokeStart : undefined}
						onStrokeEnd={isEraserMode ? bumpPageRender : undefined}
						onEyedropperPick={isEraserMode ? handleEraserEyedropperPick : undefined}
					/>
				) : null}
			</div>

			<div className="pointer-events-none absolute bottom-4 left-1/2 z-[100002] max-w-[calc(100%-2rem)] -translate-x-1/2 transform rounded-lg bg-black/70 px-4 py-2 text-center text-white backdrop-blur-sm">
				<p className="max-w-md truncate text-sm font-medium">{fileName}</p>
				<p className="mt-1 text-xs text-gray-300">
					{pageCount > 0 ? `${pageIndex + 1} / ${pageCount}` : null}
					{pageCount > 0 && fileSize ? " · " : null}
					{fileSize ? `${Math.round(fileSize / 1024)}KB` : null}
					{isEditing ? " · Editing" : null}
					{isGrayscale ? " · B&W" : null}
					{isEraserMode ? " · Eraser" : null}
					{isEditing ? " · ⌘Z undo" : null}
				</p>
			</div>
		</Modal>
	);
}
