"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { HeicConvertingOverlay } from "@/components/chats/HeicConvertingOverlay";
import type { ChatGalleryImage } from "@/utils/chatGalleryImages";
import { isChatImageFileName } from "@/utils/chatGalleryImages";

const MODAL_IMAGE_ZOOM_MAX = 5;
const MODAL_IMAGE_ZOOM_STEP = 1.25;
const MODAL_IMAGE_BOTTOM_CHROME_PX = 72;

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
	const [modalImageRotationDeg, setModalImageRotationDeg] = useState(0);
	const [modalImageScale, setModalImageScale] = useState(1);
	const [modalImgNaturalSize, setModalImgNaturalSize] = useState<{
		w: number;
		h: number;
	} | null>(null);
	const [modalZoomUsesPixelSizing, setModalZoomUsesPixelSizing] = useState(false);
	const modalScrollViewportRef = useRef<HTMLDivElement>(null);
	const modalFitScaleRef = useRef(1);

	const hasPrev = currentIndex > 0;
	const hasNext = currentIndex < images.length - 1;
	const fileExtension = current?.fileName.toLowerCase().split(".").pop();
	const isHeic = fileExtension === "heic" || fileExtension === "heif";

	const resetView = useCallback(() => {
		setModalImageRotationDeg(0);
		setModalImageScale(1);
		setModalImgNaturalSize(null);
		setModalZoomUsesPixelSizing(false);
		modalFitScaleRef.current = 1;
	}, []);

	const applyModalFitToViewport = useCallback(
		(nat: { w: number; h: number }, rotationDeg = modalImageRotationDeg) => {
			const viewport = modalScrollViewportRef.current;
			if (!viewport || !nat.w || !nat.h) return;

			const vw = viewport.clientWidth;
			const vh = Math.max(120, viewport.clientHeight - MODAL_IMAGE_BOTTOM_CHROME_PX);
			const fit = computeModalFitScale(nat.w, nat.h, vw, vh, rotationDeg);
			modalFitScaleRef.current = fit;
			setModalImageScale(fit);
			setModalZoomUsesPixelSizing(true);
		},
		[modalImageRotationDeg]
	);

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
		if (!isOpen || !modalImgNaturalSize) return;
		const frame = requestAnimationFrame(() => {
			applyModalFitToViewport(modalImgNaturalSize, modalImageRotationDeg);
		});
		return () => cancelAnimationFrame(frame);
	}, [isOpen, modalImgNaturalSize, modalImageRotationDeg, applyModalFitToViewport]);

	useEffect(() => {
		if (!isOpen) return;
		const onKeyDown = (e: KeyboardEvent) => {
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
	}, [isOpen, hasPrev, hasNext, onPrev, onNext]);

	if (!current) return null;

	const navButtonClass =
		"pointer-events-auto absolute top-1/2 z-[100003] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-35 sm:h-11 sm:w-11";
	const toolButtonClass =
		"flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8";

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			className="relative flex h-[95vh] w-[95vw] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden !bg-black/90 p-0 shadow-none border-none"
			showCloseButton={true}
			closeButtonClassName="pointer-events-auto absolute right-3 top-3 z-[100003] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 [&_path]:fill-white sm:right-6 sm:top-6 sm:h-11 sm:w-11"
			closeOnBackdropClick={true}
		>
			<div className="pointer-events-auto absolute left-0 top-3 z-[100003] flex w-[3rem] flex-col items-center gap-1.5 px-3 sm:left-3 sm:top-6 sm:w-[4.25rem] sm:gap-2">
				<button
					type="button"
					aria-label="Zoom in"
					disabled={
						modalImgNaturalSize === null ||
						modalImageScale * MODAL_IMAGE_ZOOM_STEP > MODAL_IMAGE_ZOOM_MAX + 0.0001
					}
					onClick={e => {
						e.stopPropagation();
						if (!modalImgNaturalSize) return;
						setModalZoomUsesPixelSizing(true);
						setModalImageScale(s =>
							Math.min(MODAL_IMAGE_ZOOM_MAX, s * MODAL_IMAGE_ZOOM_STEP)
						);
					}}
					className={toolButtonClass}
				>
					<span className="text-sm font-bold leading-none">+</span>
				</button>
				<button
					type="button"
					aria-label="Zoom out"
					disabled={
						modalImgNaturalSize === null ||
						modalImageScale <= modalFitScaleRef.current + 0.0001
					}
					onClick={e => {
						e.stopPropagation();
						if (!modalImgNaturalSize) return;
						setModalZoomUsesPixelSizing(true);
						const fitScale = modalFitScaleRef.current;
						setModalImageScale(s =>
							Math.max(fitScale, s / MODAL_IMAGE_ZOOM_STEP)
						);
					}}
					className={toolButtonClass}
				>
					<span className="text-sm font-bold leading-none">−</span>
				</button>
			</div>

			{images.length > 1 && (
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

			<div
				ref={modalScrollViewportRef}
				className="relative min-h-0 flex-1 overflow-auto"
			>
				<div className="relative box-border flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
					{isModalImageLoading && isHeic && <HeicConvertingOverlay variant="modal" />}
					{previewUrl ? (
						<img
							key={`${current.fileUrl}-${currentIndex}`}
							src={previewUrl}
							alt={current.fileName}
							className={`h-auto w-auto shrink-0 origin-center object-contain rounded-lg transition-[width,height] duration-200 ease-out ${
								modalImgNaturalSize ? "max-w-none" : "max-h-[calc(95vh-10rem)] max-w-full"
							}`}
							style={{
								...(modalImgNaturalSize
									? {
											width: modalImgNaturalSize.w * modalImageScale,
											height: modalImgNaturalSize.h * modalImageScale,
										}
									: {}),
								transform: `rotate(${modalImageRotationDeg}deg)`,
							}}
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
										applyModalFitToViewport(nat, modalImageRotationDeg);
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
			</div>

			<div className="pointer-events-none absolute bottom-4 left-1/2 z-[100002] max-w-[calc(100%-2rem)] -translate-x-1/2 transform rounded-lg bg-black/70 px-4 py-2 text-center text-white backdrop-blur-sm">
				<p className="max-w-md truncate text-sm font-medium">{current.fileName}</p>
				<p className="mt-1 text-xs text-gray-300">
					<span>
						{currentIndex + 1} / {images.length}
						{current.fileSize ? " · " : ""}
					</span>
					{current.fileSize ? `${Math.round(current.fileSize / 1024)}KB` : null}
				</p>
			</div>
		</Modal>
	);
}
