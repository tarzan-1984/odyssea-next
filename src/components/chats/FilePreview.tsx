"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import ChatPdfLightbox from "@/components/chats/ChatPdfLightbox";
import { HeicConvertingOverlay } from "@/components/chats/HeicConvertingOverlay";
import {
	HEIC_PREVIEW_CONVERT_ENABLED,
} from "@/config/heicPreviewConvert";
import {
	getChatImageListThumbOptions,
	CHAT_IMAGE_PREVIEW_LOAD_TIMEOUT_MS,
	isChatImageThumbnailCandidate,
	buildChatImagePreviewProxyUrl,
	isLegacyChatImagePreviewProxyUrl,
} from "@/config/chatImagePreview";
import {
	ensureChatImageThumbnail,
} from "@/utils/ensureChatImageThumbnail";
import { useChatImageGalleryOptional } from "@/components/chats/ChatImageGalleryContext";
import { useChatMediaLoad } from "@/context/ChatMediaLoadContext";
import { useLazyInViewport } from "@/hooks/useLazyInViewport";
import { ChatMediaPreviewPlaceholder } from "@/components/chats/ChatMediaPreviewPlaceholder";

const IMAGE_PREVIEW_EXTENSIONS = [
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"svg",
	"bmp",
	"tiff",
] as const;

function isRasterChatImageExtension(fileExtension: string | undefined): boolean {
	if (!fileExtension) return false;
	if (fileExtension === "heic" || fileExtension === "heif") {
		return HEIC_PREVIEW_CONVERT_ENABLED;
	}
	return IMAGE_PREVIEW_EXTENSIONS.includes(
		fileExtension as (typeof IMAGE_PREVIEW_EXTENSIONS)[number]
	);
}

function extensionNeedsPreviewSrc(fileExtension: string | undefined): boolean {
	if (!fileExtension) {
		return false;
	}
	if (fileExtension === "doc" || fileExtension === "docx") {
		return true;
	}
	if (fileExtension === "heic" || fileExtension === "heif") {
		return HEIC_PREVIEW_CONVERT_ENABLED;
	}
	return IMAGE_PREVIEW_EXTENSIONS.includes(
		fileExtension as (typeof IMAGE_PREVIEW_EXTENSIONS)[number]
	);
}

/** Rotate left (counter-clockwise) — bundled icon for image modal toolbar */
function RotateCcwIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			shapeRendering="geometricPrecision"
			textRendering="geometricPrecision"
			imageRendering="optimizeQuality"
			fillRule="evenodd"
			clipRule="evenodd"
			viewBox="0 0 500 511.61"
			className={className}
			aria-hidden
		>
			<path
				fillRule="nonzero"
				d="m218.54 261.95 15.5 101.27c.56 3.8-.47 7.81-3.19 10.93-4.92 5.64-13.5 6.24-19.14 1.32L4.64 195.09l-1.53-1.59c-4.77-5.76-3.96-14.32 1.8-19.08L211.98 3.08c2.99-2.41 6.96-3.59 11.03-2.87 7.34 1.31 12.22 8.35 10.91 15.69l-15.44 85.83c17.97 2.09 37.59 6.57 57.77 13.36 52.66 17.69 109.96 51.41 153.32 100.33 43.79 49.39 73.45 114.21 70.18 193.61-1.17 28.92-6.76 59.73-17.63 92.34-1.34 5.29-5.82 9.46-11.55 10.14-7.44.88-14.19-4.44-15.06-11.87-11.94-100.09-50.53-158.11-98.25-191.8-42.66-30.12-93.19-41.36-138.72-45.89z"
			/>
		</svg>
	);
}

/** Zoom out — bundled icon for image modal toolbar (provided SVG paths) */
function ZoomOutIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 122.879 119.801"
			className={className}
			aria-hidden
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				clipRule="evenodd"
				d="M49.991,0h0.015v0.006c13.794,0.004,26.294,5.601,35.336,14.645 c9.026,9.031,14.618,21.515,14.628,35.303h0.006v0.034v0.04h-0.006c-0.005,5.557-0.918,10.905-2.594,15.892 c-0.281,0.837-0.576,1.641-0.877,2.409v0.007c-1.446,3.661-3.315,7.12-5.548,10.307l29.08,26.14l0.018,0.015l0.157,0.146 l0.012,0.012c1.641,1.563,2.535,3.656,2.648,5.779c0.11,2.1-0.538,4.248-1.976,5.971l-0.011,0.016l-0.176,0.204l-0.039,0.046 l-0.145,0.155l-0.011,0.011c-1.563,1.642-3.656,2.539-5.782,2.651c-2.104,0.111-4.254-0.54-5.975-1.978l-0.012-0.012l-0.203-0.175 l-0.029-0.024L78.764,90.865c-0.88,0.62-1.779,1.207-2.687,1.763c-1.234,0.756-2.51,1.467-3.816,2.117 c-6.699,3.342-14.266,5.223-22.27,5.223v0.006h-0.016v-0.006c-13.797-0.005-26.297-5.601-35.334-14.644l-0.004,0.005 C5.608,76.3,0.016,63.81,0.007,50.021H0v-0.033v-0.016h0.007c0.005-13.799,5.601-26.297,14.646-35.339C23.684,5.607,36.169,0.015,49.958,0.006V0H49.991L49.991,0z M67.787,43.397c1.21-0.007,2.353,0.312,3.322,0.872l-0.002,0.002 c0.365,0.21,0.708,0.454,1.01,0.715c0.306,0.264,0.594,0.569,0.851,0.895h0.004c0.873,1.11,1.397,2.522,1.394,4.053 c-0.003,1.216-0.335,2.358-0.906,3.335c-0.454,0.78-1.069,1.461-1.791,1.996c-0.354,0.261-0.751,0.496-1.168,0.688v0.002 c-0.823,0.378-1.749,0.595-2.722,0.6l-35.166,0.248c-1.209,0.011-2.354-0.31-3.327-0.873l0.002-0.002 c-0.37-0.212-0.715-0.458-1.016-0.722c-0.306-0.264-0.589-0.567-0.844-0.891h-0.004c-0.873-1.112-1.397-2.522-1.393-4.053 c0.002-1.213,0.337-2.354,0.906-3.328l-0.004-0.002c0.376-0.642,0.869-1.225,1.442-1.714h0.004 c0.574-0.489,1.236-0.883,1.942-1.151c0.704-0.266,1.484-0.418,2.296-0.423L67.787,43.397L67.787,43.397z M50.006,11.212v0.006 h-0.015h-0.034v-0.006C39.274,11.219,29.59,15.56,22.581,22.566l0.002,0.002c-7.019,7.018-11.365,16.711-11.368,27.404h0.006v0.016 v0.033h-0.006c0.006,10.683,4.347,20.365,11.354,27.377l0.002-0.002c7.018,7.018,16.711,11.365,27.404,11.367v-0.007h0.016h0.033 v0.007c10.685-0.007,20.367-4.348,27.381-11.359c7.012-7.009,11.359-16.702,11.361-27.401H88.76v-0.015v-0.034h0.007 C88.76,39.273,84.419,29.591,77.407,22.58v-0.007C70.398,15.562,60.705,11.214,50.006,11.212L50.006,11.212z"
			/>
		</svg>
	);
}

/** Zoom in — bundled icon for image modal toolbar (provided SVG paths) */
function ZoomInIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 122.879 119.801"
			className={className}
			aria-hidden
		>
			<path
				fill="currentColor"
				d="M49.991,0h0.015v0.006c13.794,0.004,26.294,5.601,35.336,14.645c9.026,9.031,14.618,21.515,14.628,35.303h0.006v0.034v0.04 h-0.006c-0.005,5.557-0.918,10.905-2.594,15.892c-0.281,0.837-0.576,1.641-0.877,2.409v0.007c-1.446,3.661-3.315,7.12-5.548,10.307 l29.08,26.14l0.018,0.015l0.157,0.146l0.012,0.012c1.641,1.563,2.535,3.656,2.648,5.779c0.11,2.1-0.538,4.248-1.976,5.971 l-0.011,0.016l-0.176,0.204l-0.039,0.046l-0.145,0.155l-0.011,0.011c-1.563,1.642-3.656,2.539-5.782,2.651 c-2.104,0.111-4.254-0.54-5.975-1.978l-0.012-0.012l-0.203-0.175l-0.029-0.024L78.764,90.865c-0.88,0.62-1.779,1.207-2.687,1.763 c-1.234,0.756-2.51,1.467-3.816,2.117c-6.699,3.342-14.266,5.223-22.27,5.223v0.006h-0.016v-0.006 c-13.797-0.005-26.297-5.601-35.334-14.644l-0.004,0.005C5.608,76.3,0.016,63.81,0.007,50.021H0v-0.033v-0.016h0.007 c0.005-13.799,5.601-26.297,14.646-35.339C23.684,5.607,36.169,0.015,49.958,0.006V0H49.991L49.991,0z M67.787,43.397 c1.21-0.007,2.353,0.312,3.322,0.872l-0.002,0.002c0.365,0.21,0.708,0.454,1.01,0.715c0.306,0.264,0.594,0.569,0.851,0.895h0.004 c0.873,1.11,1.397,2.522,1.394,4.053c-0.003,1.216-0.335,2.358-0.906,3.335c-0.454,0.78-1.069,1.461-1.791,1.996 c-0.354,0.261-0.751,0.496-1.168,0.688v0.002c-0.823,0.378-1.749,0.595-2.722,0.6l-11.051,0.08l-0.08,11.062 c-0.004,1.034-0.254,2.02-0.688,2.886c-0.188,0.374-0.417,0.737-0.678,1.074l-0.006,0.007c-0.257,0.329-0.551,0.644-0.866,0.919 c-1.169,1.025-2.713,1.649-4.381,1.649v-0.007c-0.609,0-1.195-0.082-1.743-0.232c-1.116-0.306-2.115-0.903-2.899-1.689 c-0.788-0.791-1.377-1.787-1.672-2.893v-0.006c-0.144-0.543-0.22-1.128-0.215-1.728v-0.005l0.075-10.945l-10.962,0.076 c-1.209,0.011-2.354-0.31-3.327-0.873l0.002-0.002c-0.37-0.212-0.715-0.458-1.016-0.722c-0.306-0.264-0.589-0.567-0.844-0.891 h-0.004c-0.873-1.112-1.397-2.522-1.393-4.053c0.002-1.213,0.337-2.354,0.906-3.328l-0.004-0.002 c0.376-0.642,0.869-1.225,1.442-1.714h0.004c0.574-0.489,1.236-0.883,1.942-1.151c0.704-0.266,1.484-0.418,2.296-0.423 l11.051-0.082l0.08-11.062c0.004-1.207,0.345-2.345,0.921-3.309l0.004,0.002c0.224-0.374,0.467-0.715,0.727-1.003 c0.264-0.296,0.576-0.584,0.908-0.839l0.005-0.004v0.002c1.121-0.861,2.533-1.379,4.055-1.375c1.211,0.002,2.352,0.332,3.317,0.897 c0.479,0.279,0.928,0.631,1.32,1.025l0.004-0.004c0.383,0.383,0.73,0.834,1.019,1.333c0.56,0.968,0.879,2.104,0.868,3.304 l-0.075,10.942L67.787,43.397L67.787,43.397z M50.006,11.212v0.006h-0.015h-0.034v-0.006C39.274,11.219,29.59,15.56,22.581,22.566 l0.002,0.002c-7.019,7.018-11.365,16.711-11.368,27.404h0.006v0.016v0.033h-0.006c0.006,10.683,4.347,20.365,11.354,27.377 l0.002-0.002c7.018,7.018,16.711,11.365,27.404,11.367v-0.007h0.016h0.033v0.007c10.685-0.007,20.367-4.348,27.381-11.359 c7.012-7.009,11.359-16.702,11.361-27.401H88.76v-0.015v-0.034h0.007C88.76,39.273,84.419,29.591,77.407,22.58v-0.007 C70.398,15.562,60.705,11.214,50.006,11.212L50.006,11.212z"
			/>
		</svg>
	);
}

/** Rotate right (clockwise) — bundled icon for image modal toolbar */
function RotateCwIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			shapeRendering="geometricPrecision"
			textRendering="geometricPrecision"
			imageRendering="optimizeQuality"
			fillRule="evenodd"
			clipRule="evenodd"
			viewBox="0 0 500 511.61"
			className={className}
			aria-hidden
		>
			<path
				fillRule="nonzero"
				d="m265.96 363.22 15.5-101.27c-45.53 4.53-96.07 15.77-138.72 45.89-47.72 33.69-86.32 91.71-98.25 191.8-.87 7.43-7.62 12.75-15.06 11.87-5.73-.68-10.21-4.86-11.55-10.14C7 468.76 1.42 437.95.25 409.03c-3.27-79.4 26.39-144.22 70.18-193.61 43.36-48.92 100.66-82.64 153.32-100.33 20.18-6.8 39.79-11.27 57.77-13.36L266.08 15.9c-1.32-7.34 3.57-14.38 10.91-15.69 4.07-.72 8.04.46 11 2.9l207.1 171.3c5.76 4.77 6.57 13.33 1.8 19.08l-1.54 1.59-207.06 180.39c-5.64 4.92-14.22 4.32-19.14-1.32a13.529 13.529 0 0 1-3.19-10.93z"
			/>
		</svg>
	);
}

/** Zoom uses intrinsic pixel size × factor so overflow/scroll expands with magnification. */
const MODAL_IMAGE_ZOOM_MAX = 5;
const MODAL_IMAGE_ZOOM_STEP = 1.25;
/** Space reserved for filename badge at bottom of image modal */
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

interface FilePreviewProps {
	fileUrl: string;
	fileName: string;
	fileSize?: number;
	messageId?: string;
	/** Thumbnail only + same image/document modals as full card (for multi-attach grid). */
	compact?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({
	fileUrl,
	fileName,
	fileSize,
	messageId,
	compact = false,
}) => {
	const [previewContent, setPreviewContent] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string>("");
	const [isImageModalOpen, setIsImageModalOpen] = useState(false);
	const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
	const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
	const [isModalImageLoading, setIsModalImageLoading] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);
	const [modalImageRotationDeg, setModalImageRotationDeg] = useState(0);
	const [modalImageScale, setModalImageScale] = useState(1);
	const [modalImgNaturalSize, setModalImgNaturalSize] = useState<{
		w: number;
		h: number;
	} | null>(null);
	const [modalZoomUsesPixelSizing, setModalZoomUsesPixelSizing] = useState(false);
	const modalScrollViewportRef = useRef<HTMLDivElement>(null);
	const modalFitScaleRef = useRef(1);
	const modalImageViewportRef = useRef<HTMLDivElement>(null);
	const thumbEnsureAttemptedRef = useRef(false);
	const proxyFallbackAttemptedRef = useRef(false);
	const imagePreviewLoadKeyRef = useRef<string | null>(null);
	const chatImageGallery = useChatImageGalleryOptional();
	const { mediaLoadEnabled, scrollRoot } = useChatMediaLoad();
	const { elementRef, inView } = useLazyInViewport({
		root: scrollRoot,
		resetKey: fileUrl,
	});
	const shouldLoadMedia = mediaLoadEnabled && inView;
	const thumbOptions = useMemo(() => getChatImageListThumbOptions(compact), [compact]);
	const { maxWidth: thumbMaxWidth, quality: thumbQuality } = thumbOptions;
	const fileExtension = fileName.toLowerCase().split(".").pop();
	const isImage =
		fileExtension &&
		["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif", "bmp", "tiff"].includes(
			fileExtension
		);

	const openImageViewer = useCallback(() => {
		if (chatImageGallery && isImage) {
			chatImageGallery.openImage({ fileUrl, fileName, fileSize });
			return;
		}
		if (fileExtension === "heic" || fileExtension === "heif") {
			setIsModalImageLoading(true);
		}
		setIsImageModalOpen(true);
	}, [chatImageGallery, fileUrl, fileName, fileSize, isImage, fileExtension]);

	const handleInlineImageMount = useCallback((img: HTMLImageElement | null) => {
		if (!img) return;
		if (img.complete) {
			if (img.naturalHeight > 0) {
				setIsLoading(false);
			} else {
				img.dispatchEvent(new Event("error"));
			}
		}
	}, []);

	const handleInlineImageError = useCallback(
		(e: React.SyntheticEvent<HTMLImageElement>) => {
			const target = e.target as HTMLImageElement;
			target.style.display = "";

			if (!thumbEnsureAttemptedRef.current && isChatImageThumbnailCandidate(fileName)) {
				thumbEnsureAttemptedRef.current = true;
				setError("");
				setIsLoading(true);
				ensureChatImageThumbnail(fileUrl, fileName, thumbOptions)
					.then(url => {
						setPreviewContent(url);
					})
					.catch(() => {
						proxyFallbackAttemptedRef.current = true;
						setPreviewContent(buildChatImagePreviewProxyUrl(fileUrl, thumbOptions));
					});
				return;
			}

			if (
				!proxyFallbackAttemptedRef.current &&
				!isLegacyChatImagePreviewProxyUrl(previewContent)
			) {
				proxyFallbackAttemptedRef.current = true;
				setError("");
				setIsLoading(true);
				setPreviewContent(buildChatImagePreviewProxyUrl(fileUrl, thumbOptions));
				return;
			}

			setPreviewContent("");
			setError("Tap to view image");
			setIsLoading(false);
		},
		[fileUrl, fileName, thumbOptions, previewContent]
	);

	useEffect(() => {
		thumbEnsureAttemptedRef.current = false;
		proxyFallbackAttemptedRef.current = false;
		imagePreviewLoadKeyRef.current = null;
		setPreviewContent("");
		setIsLoading(false);
		setError("");
	}, [fileUrl]);

	useEffect(() => {
		if (shouldLoadMedia) return;

		setPreviewContent("");
		setIsLoading(false);
		setError("");
		thumbEnsureAttemptedRef.current = false;
		proxyFallbackAttemptedRef.current = false;
		imagePreviewLoadKeyRef.current = null;
	}, [shouldLoadMedia]);

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

	const closeImageModal = useCallback(() => {
		setModalImageRotationDeg(0);
		setModalImageScale(1);
		setModalImgNaturalSize(null);
		setModalZoomUsesPixelSizing(false);
		modalFitScaleRef.current = 1;
		setIsImageModalOpen(false);
	}, []);

	useEffect(() => {
		setModalImgNaturalSize(null);
		setModalImageScale(1);
		setModalImageRotationDeg(0);
		setModalZoomUsesPixelSizing(false);
	}, [fileUrl]);

	useEffect(() => {
		if (!isImageModalOpen || !modalImgNaturalSize) return;
		const frame = requestAnimationFrame(() => {
			applyModalFitToViewport(modalImgNaturalSize, modalImageRotationDeg);
		});
		return () => cancelAnimationFrame(frame);
	}, [isImageModalOpen, modalImgNaturalSize, modalImageRotationDeg, applyModalFitToViewport]);

	useEffect(() => {
		if (!shouldLoadMedia) {
			return;
		}

		const loadKey = `${fileUrl}|${thumbMaxWidth}|${thumbQuality}`;
		if (imagePreviewLoadKeyRef.current === loadKey) {
			return;
		}
		imagePreviewLoadKeyRef.current = loadKey;

		const loadPreview = async () => {
			try {
				setIsLoading(true);
				setError("");

				if (fileExtension === "txt") {
					// Load text file content
					const response = await fetch(fileUrl);
					const text = await response.text();
					setPreviewContent(text);
				} else if (fileExtension === "pdf") {
					// For PDF, we'll use iframe approach
					setPreviewContent(fileUrl);
				} else if (fileExtension === "docx" || fileExtension === "doc") {
					// For DOC/DOCX, use Microsoft Office web viewer
					// Embed variant keeps it inside our UI
					const officeViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
					setPreviewContent(officeViewer);
				} else if (
					fileExtension &&
					[
						"jpg",
						"jpeg",
						"png",
						"gif",
						"webp",
						"svg",
						"heic",
						"heif",
						"bmp",
						"tiff",
					].includes(fileExtension)
				) {
					const isHeicExt = fileExtension === "heic" || fileExtension === "heif";

					if (isHeicExt && !HEIC_PREVIEW_CONVERT_ENABLED) {
						setPreviewContent("");
						setIsLoading(false);
						return;
					}

					if (fileExtension === "svg") {
						setPreviewContent(fileUrl);
						return;
					}

					if (!isChatImageThumbnailCandidate(fileName)) {
						setPreviewContent("");
						setError("Tap to view image");
						setIsLoading(false);
						return;
					}

					thumbEnsureAttemptedRef.current = true;
					const ensured = await ensureChatImageThumbnail(
						fileUrl,
						fileName,
						thumbOptions
					).catch(() => null);
					if (ensured) {
						setPreviewContent(ensured);
						return;
					}

					proxyFallbackAttemptedRef.current = true;
					setPreviewContent(buildChatImagePreviewProxyUrl(fileUrl, thumbOptions));
				}
			} catch (err) {
				setError("Failed to load preview");
				console.error("Preview error:", err);
				setIsLoading(false);
			} finally {
				// Raster images keep loading until <img onLoad>
				if (!isRasterChatImageExtension(fileExtension)) {
					setIsLoading(false);
				}
			}
		};

		loadPreview();
	}, [shouldLoadMedia, fileUrl, fileExtension, fileName, thumbMaxWidth, thumbQuality]);

	useEffect(() => {
		if (!isLoading || !previewContent) return;
		if (!isRasterChatImageExtension(fileExtension)) return;
		if (fileExtension === "svg") return;

		const timeoutId = window.setTimeout(() => {
			if (isLegacyChatImagePreviewProxyUrl(previewContent)) {
				setPreviewContent("");
				setError("Tap to view image");
				setIsLoading(false);
				return;
			}

			proxyFallbackAttemptedRef.current = true;
			setPreviewContent(
				buildChatImagePreviewProxyUrl(fileUrl, {
					maxWidth: thumbMaxWidth,
					quality: thumbQuality,
				})
			);
		}, CHAT_IMAGE_PREVIEW_LOAD_TIMEOUT_MS);

		return () => window.clearTimeout(timeoutId);
	}, [isLoading, previewContent, fileUrl, fileExtension, thumbMaxWidth, thumbQuality]);

	const showPreviewContent = shouldLoadMedia;

	const wrapWithLazyGate = (content: React.ReactNode) => (
		<div ref={elementRef} className="w-full min-h-0">
			{showPreviewContent ? (
				content
			) : (
				<ChatMediaPreviewPlaceholder compact={compact} fileExtension={fileExtension} />
			)}
		</div>
	);

	const renderPreview = () => {
		if (error) {
			return (
				<div
					className={`flex items-center justify-center ${compact ? "h-24" : "h-32"} text-red-500 px-1 text-center text-xs`}
				>
					<p>{error}</p>
				</div>
			);
		}

		// Avoid mounting <img>/<iframe> with src="" before preview URL is ready
		if (extensionNeedsPreviewSrc(fileExtension) && !previewContent && !error) {
			if (fileExtension === "heic" || fileExtension === "heif") {
				return (
					<div
						className={`relative w-full ${
							compact ? "h-24" : "min-h-[180px]"
						} overflow-hidden rounded-lg`}
					>
						<HeicConvertingOverlay />
					</div>
				);
			}
			return (
				<div className={`flex items-center justify-center ${compact ? "h-24" : "min-h-[180px]"}`}>
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
				</div>
			);
		}

		// Raster images keep isLoading true until <img onLoad>; they must mount the img (see case jpg/heic).
		if (isLoading && !isRasterChatImageExtension(fileExtension)) {
			return (
				<div className={`flex items-center justify-center ${compact ? "h-24" : "min-h-[180px]"}`}>
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
				</div>
			);
		}

		switch (fileExtension) {
			case "txt":
				return (
					<div
						className={`max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
							compact ? "max-h-24 text-[10px] leading-snug" : ""
						}`}
						onClick={e => {
							e.stopPropagation();
							setIsDocumentModalOpen(true);
						}}
					>
						<pre className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
							{previewContent}
						</pre>
					</div>
				);

			case "pdf":
				return (
					<div
						className={`${
							compact ? "h-24" : "h-64"
						} border rounded overflow-hidden relative cursor-pointer group`}
					>
						<iframe
							src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
							className="w-full h-full pointer-events-none"
							title="PDF Preview"
							allow="fullscreen"
							allowFullScreen={false}
						/>
						<div
							className="absolute inset-0 z-10 group-hover:bg-black/5 transition-colors"
							onClick={e => {
								e.stopPropagation();
								setIsPdfModalOpen(true);
							}}
						/>
					</div>
				);

			case "docx":
			case "doc":
				return (
					<div
						className={`${
							compact ? "h-24" : "h-64"
						} border rounded overflow-hidden relative cursor-pointer group`}
					>
						{previewContent ? (
							<iframe
								src={previewContent}
								className="w-full h-full pointer-events-none"
								title="DOC/DOCX Preview"
								allow="fullscreen"
								allowFullScreen={false}
							/>
						) : null}
						<div
							className="absolute inset-0 z-10 group-hover:bg-black/5 transition-colors"
							onClick={e => {
								e.stopPropagation();
								setIsDocumentModalOpen(true);
							}}
						/>
					</div>
				);
			case "jpg":
			case "jpeg":
			case "png":
			case "gif":
			case "webp":
			case "svg":
			case "bmp":
			case "tiff":
				return (
					<div
						className={`w-full ${
							compact ? "max-w-none h-24" : "max-w-[280px]"
						} overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity relative ${
							compact ? "min-h-0" : "min-h-[180px]"
						}`}
						onClick={e => {
							e.stopPropagation();
							openImageViewer();
						}}
					>
						{isLoading ? (
							<HeicConvertingOverlay message="Loading image..." />
						) : null}
						{previewContent ? (
							<img
								key={previewContent}
								ref={handleInlineImageMount}
								src={previewContent}
								alt="File preview"
								loading="lazy"
								decoding="async"
								className={`object-cover w-full ${compact ? "h-24 max-h-24" : "h-auto max-h-64"} ${
									isLoading ? "opacity-0" : ""
								}`}
								onLoad={() => setIsLoading(false)}
								onError={handleInlineImageError}
							/>
						) : null}
					</div>
				);
			case "heic":
			case "heif":
				if (!HEIC_PREVIEW_CONVERT_ENABLED) {
					return (
						<div
							className={`flex items-center justify-center ${
								compact ? "h-24" : "h-32"
							} bg-gray-100 dark:bg-gray-800 rounded px-2 text-center`}
						>
							<p className="text-xs text-gray-500 dark:text-gray-400">
								HEIC preview off (test)
							</p>
						</div>
					);
				}
				// HEIC/HEIF files are converted to JPEG on the server side
				// Always show loader overlay if isLoading is true
				return (
					<div
						className={`w-full ${
							compact ? "max-w-none h-24" : "max-w-[400px]"
						} overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
							compact ? "relative min-h-0" : "relative min-h-[180px]"
						}`}
						onClick={e => {
							e.stopPropagation();
							openImageViewer();
						}}
					>
						{isLoading ? (
							<HeicConvertingOverlay message="Loading image..." />
						) : null}
						{previewContent ? (
							<img
								key={previewContent}
								ref={handleInlineImageMount}
								src={previewContent}
								alt="File preview"
								loading="lazy"
								decoding="async"
								className={`object-cover w-full ${compact ? "h-24 max-h-24" : "h-auto max-h-64"} ${
									isLoading ? "opacity-0" : ""
								}`}
								onLoad={() => {
									setIsLoading(false);
								}}
								onError={handleInlineImageError}
							/>
						) : null}
					</div>
				);

			default:
				return (
					<div
						className={`flex items-center justify-center ${
							compact ? "h-24" : "h-32"
						} bg-gray-50 dark:bg-gray-800 rounded px-1 text-center`}
					>
						<p
							className={`text-gray-600 dark:text-gray-400 ${compact ? "text-[10px]" : "text-sm"}`}
						>
							Preview not available
						</p>
					</div>
				);
		}
	};

	return (
		<>
			{compact ? (
				wrapWithLazyGate(
					<div className="w-full min-h-0 overflow-hidden">{renderPreview()}</div>
				)
			) : (
				wrapWithLazyGate(
				<div className="mb-2 w-full max-w-[400px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800">
						<div className="flex items-center space-x-2">
							<svg
								className="w-4 h-4 text-gray-600 dark:text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<span className="text-sm font-medium text-gray-900 dark:text-white truncate">
								{fileName}
							</span>
							{fileSize && (
								<span className="text-xs text-gray-500 dark:text-gray-400">
									({Math.round(fileSize / 1024)}KB)
								</span>
							)}
						</div>
					</div>

					{/* Preview Content */}
					<div className="relative p-2">
						{renderPreview()}
						{isDownloading &&
							(fileExtension === "heic" || fileExtension === "heif") && (
								<HeicConvertingOverlay className="z-20 rounded-none" />
							)}
					</div>

					{/* Download Button */}
					<div className="p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
						<button
							type="button"
							disabled={isDownloading}
							onClick={async e => {
								e.preventDefault();
								e.stopPropagation();
								const { downloadChatFile } = await import(
									"@/utils/downloadChatFile"
								);
								try {
									await downloadChatFile(fileUrl, fileName, {
										onConvertingStart: () => setIsDownloading(true),
										onConvertingEnd: () => setIsDownloading(false),
									});
								} catch {
									setIsDownloading(false);
								}
							}}
							className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<span>Download</span>
						</button>
					</div>
				</div>
				)
			)}

			{/* Fallback image modal when gallery provider is not available (e.g. Files modal) */}
			{isImage && !chatImageGallery && (
				<Modal
					isOpen={isImageModalOpen}
					onClose={closeImageModal}
					className="relative flex h-[95vh] w-[95vw] max-h-[95vh] max-w-[95vw] flex-col overflow-hidden !bg-black/90 p-0 shadow-none border-none"
					showCloseButton={true}
					closeButtonClassName="pointer-events-auto absolute right-3 top-3 z-[100003] flex h-9.5 w-9.5 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 [&_path]:fill-white sm:right-6 sm:top-6 sm:h-11 sm:w-11"
					closeOnBackdropClick={true}
				>
					{/* Zoom +/- — anchored top-left (below title bar), fixed while image scrolls */}
					<div className="pointer-events-auto absolute left-0 top-3 z-[100003] flex w-[3rem] flex-col items-center gap-1.5 px-3 sm:left-3 sm:top-6 sm:w-[4.25rem] sm:gap-2">
						<button
							type="button"
							aria-label="Zoom in"
							disabled={
								modalImgNaturalSize === null ||
								modalImageScale * MODAL_IMAGE_ZOOM_STEP >
									MODAL_IMAGE_ZOOM_MAX + 0.0001
							}
							onClick={e => {
								e.stopPropagation();
								const nat = modalImgNaturalSize;
								if (!nat?.w || !nat?.h) return;
								setModalZoomUsesPixelSizing(true);
								setModalImageScale(s =>
									Math.min(MODAL_IMAGE_ZOOM_MAX, s * MODAL_IMAGE_ZOOM_STEP)
								);
							}}
							className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8"
						>
							<ZoomInIcon className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
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
								const nat = modalImgNaturalSize;
								if (!nat?.w || !nat?.h) return;
								setModalZoomUsesPixelSizing(true);
								const fitScale = modalFitScaleRef.current;
								setModalImageScale(s =>
									Math.max(fitScale, s / MODAL_IMAGE_ZOOM_STEP)
								);
							}}
							className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 disabled:pointer-events-none disabled:opacity-40 sm:h-8 sm:w-8"
						>
							<ZoomOutIcon className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
						</button>
					</div>

					{/* Top toolbar — shrink-0 row is transparent to clicks except rotate buttons */}
					<div className="pointer-events-none flex shrink-0 justify-center px-4 pb-2 pt-3 sm:pb-2 sm:pt-4">
						<div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
							<button
								type="button"
								aria-label="Rotate image counter-clockwise"
								onClick={e => {
									e.stopPropagation();
									setModalImageRotationDeg(d => (((d - 90) % 360) + 360) % 360);
								}}
								className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 sm:h-8 sm:w-8"
							>
								<RotateCcwIcon className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
							</button>
							<button
								type="button"
								aria-label="Rotate image clockwise"
								onClick={e => {
									e.stopPropagation();
									setModalImageRotationDeg(d => (d + 90) % 360);
								}}
								className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white shadow-md ring-1 ring-white/40 transition-colors hover:bg-black/70 hover:ring-white/60 sm:h-8 sm:w-8"
							>
								<RotateCwIcon className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
							</button>
						</div>
					</div>

					{/* Scrollable image area only */}
					<div
						ref={modalScrollViewportRef}
						className="relative min-h-0 flex-1 overflow-auto"
					>
						<div
							ref={modalImageViewportRef}
							className="relative box-border flex min-h-full min-w-full items-center justify-center p-4 sm:p-8"
						>
							{isModalImageLoading &&
								(fileExtension === "heic" || fileExtension === "heif") && (
									<HeicConvertingOverlay variant="modal" />
								)}

							{/* Image */}
							{previewContent ? (
								<img
									src={previewContent}
									alt={fileName}
									className={`h-auto w-auto shrink-0 origin-center object-contain rounded-lg transition-[width,height] duration-200 ease-out ${
										modalImgNaturalSize
											? "max-w-none"
											: "max-h-[calc(95vh-10rem)] max-w-full"
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
										setIsLoading(false);
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
										if (target.complete && target.naturalHeight !== 0) {
											setIsModalImageLoading(false);
										}
									}}
									onError={e => {
										const target = e.target as HTMLImageElement;
										target.style.display = "none";
										setError("Failed to load image");
										setIsModalImageLoading(false);
									}}
								/>
							) : (
								<div className="flex items-center justify-center h-64">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
								</div>
							)}
						</div>
					</div>

					{/* Image Info — anchored to modal panel bottom, outside scroll */}
					<div className="pointer-events-none absolute bottom-4 left-1/2 z-[100002] max-w-[calc(100%-2rem)] -translate-x-1/2 transform px-4 py-2 text-center text-white backdrop-blur-sm rounded-lg bg-black/70">
						<p className="text-sm font-medium truncate max-w-md">{fileName}</p>
						{fileSize && (
							<p className="text-xs text-gray-300 mt-1">
								{Math.round(fileSize / 1024)}KB
							</p>
						)}
					</div>
				</Modal>
			)}

			{/* Document Modal */}
			{(fileExtension === "txt" ||
				fileExtension === "docx" ||
				fileExtension === "doc") && (
				<Modal
					isOpen={isDocumentModalOpen}
					onClose={() => setIsDocumentModalOpen(false)}
					className="w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] flex flex-col bg-white dark:bg-gray-900 shadow-none border-none p-0 overflow-hidden"
					showCloseButton={false}
					closeOnBackdropClick={true}
				>
					{/* Document Header */}
					<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
						<div className="flex items-center space-x-2">
							<svg
								className="w-5 h-5 text-gray-600 dark:text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<span className="text-sm font-medium text-gray-900 dark:text-white truncate">
								{fileName}
							</span>
							{fileSize && (
								<span className="text-xs text-gray-500 dark:text-gray-400">
									({Math.round(fileSize / 1024)}KB)
								</span>
							)}
						</div>
						{/* Close Button */}
						<button
							onClick={() => setIsDocumentModalOpen(false)}
							className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:h-11 sm:w-11"
						>
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
									fill="currentColor"
								/>
							</svg>
						</button>
					</div>

					{/* Document Content - Scrollable */}
					<div className="flex-1 overflow-auto p-4">
						{fileExtension === "txt" && (
							<div className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm">
								<pre className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
									{previewContent}
								</pre>
							</div>
						)}

						{(fileExtension === "docx" || fileExtension === "doc") && previewContent && (
							<div className="w-full h-full min-h-[600px] border rounded overflow-hidden">
								<iframe
									src={previewContent}
									className="w-full h-full min-h-[600px]"
									title="DOC/DOCX Preview"
									allow="fullscreen"
									allowFullScreen={true}
								/>
							</div>
						)}
					</div>
				</Modal>
			)}

			{fileExtension === "pdf" && (
				<ChatPdfLightbox
					isOpen={isPdfModalOpen}
					fileUrl={fileUrl}
					fileName={fileName}
					fileSize={fileSize}
					onClose={() => setIsPdfModalOpen(false)}
				/>
			)}
		</>
	);
};

export default FilePreview;
