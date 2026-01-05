"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";

interface FilePreviewProps {
	fileUrl: string;
	fileName: string;
	fileSize?: number;
	messageId?: string;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileUrl, fileName, fileSize, messageId }) => {
	const [previewContent, setPreviewContent] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>("");
	const [isImageModalOpen, setIsImageModalOpen] = useState(false);
	const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
	const [isModalImageLoading, setIsModalImageLoading] = useState(false);
	const [convertedImageUrl, setConvertedImageUrl] = useState<string | null>(null);

	const fileExtension = fileName.toLowerCase().split(".").pop();
	const isImage =
		fileExtension &&
		["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "heif", "bmp", "tiff"].includes(
			fileExtension
		);

	useEffect(() => {
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
					// For HEIC/HEIF files, use server-side conversion to JPEG
					if (fileExtension === "heic" || fileExtension === "heif") {
						try {
							// Request server-side conversion to JPEG
							const conversionUrl = `/api/storage/convert-heic?url=${encodeURIComponent(fileUrl)}`;

							// Keep loading state true until image loads
							// The server will return JPEG, so we can use it directly as image source
							setPreviewContent(conversionUrl);
							// Don't set isLoading to false here - let the image onLoad handler do it
						} catch (err) {
							setPreviewContent("");
							setError(
								"HEIC preview is not available. Please download the file to view it."
							);
							setIsLoading(false);
						}
					} else {
						// For other images, just set the URL
						setPreviewContent(fileUrl);
					}
				}
			} catch (err) {
				setError("Failed to load preview");
				console.error("Preview error:", err);
				setIsLoading(false);
			} finally {
				// For HEIC files, don't set isLoading to false here
				// It will be set to false when the image loads (onLoad handler)
				if (fileExtension !== "heic" && fileExtension !== "heif") {
					setIsLoading(false);
				}
			}
		};

		loadPreview();

		// Cleanup: revoke object URL when component unmounts or fileUrl changes
		return () => {
			if (convertedImageUrl) {
				URL.revokeObjectURL(convertedImageUrl);
				setConvertedImageUrl(null);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fileUrl, fileExtension]);

	const renderPreview = () => {
		// For HEIC files, show loader overlay on top of image, not as separate component
		if (error && !(fileExtension === "heic" || fileExtension === "heif")) {
			return (
				<div className="flex items-center justify-center h-32 text-red-500">
					<p>{error}</p>
				</div>
			);
		}

		// For non-HEIC files, show general loader if loading
		if (isLoading && !(fileExtension === "heic" || fileExtension === "heif")) {
			return (
				<div className="flex items-center justify-center h-32">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
				</div>
			);
		}

		switch (fileExtension) {
			case "txt":
				return (
					<div
						className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
					<div className="h-64 border rounded overflow-hidden relative cursor-pointer group">
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
								setIsDocumentModalOpen(true);
							}}
						/>
					</div>
				);

			case "docx":
			case "doc":
				return (
					<div className="h-64 border rounded overflow-hidden relative cursor-pointer group">
						<iframe
							src={previewContent}
							className="w-full h-full pointer-events-none"
							title="DOC/DOCX Preview"
							allow="fullscreen"
							allowFullScreen={false}
						/>
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
						className="w-full max-w-[400px] overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
						onClick={e => {
							e.stopPropagation();
							setIsImageModalOpen(true);
						}}
					>
						<img
							src={previewContent}
							alt="File preview"
							className="object-cover w-full h-auto max-h-64"
							onError={e => {
								// Hide image if it fails to load
								const target = e.target as HTMLImageElement;
								target.style.display = "none";
								setError("Failed to load image preview");
							}}
						/>
					</div>
				);
			case "heic":
			case "heif":
				// HEIC/HEIF files are converted to JPEG on the server side
				// Always show loader overlay if isLoading is true
				return (
					<div
						className="w-full max-w-[400px] overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity relative min-h-[180px]"
						onClick={e => {
							e.stopPropagation();
							// Reset modal loading state when opening modal for HEIC files
							if (fileExtension === "heic" || fileExtension === "heif") {
								setIsModalImageLoading(true);
							}
							setIsImageModalOpen(true);
						}}
					>
						{isLoading && (
							<div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg z-10">
								<div className="flex flex-col items-center gap-2">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
									<p className="text-xs text-gray-600 dark:text-gray-400">
										Converting HEIC...
									</p>
								</div>
							</div>
						)}
						{previewContent && (
							<img
								src={previewContent}
								alt="File preview"
								className="object-cover w-full h-auto max-h-64"
								onLoad={() => {
									// Image loaded successfully, hide loader
									setIsLoading(false);
								}}
								onError={e => {
									// Hide image if it fails to load
									const target = e.target as HTMLImageElement;
									target.style.display = "none";
									setError("Failed to load image preview");
									setIsLoading(false);
								}}
							/>
						)}
					</div>
				);

			default:
				return (
					<div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-800 rounded">
						<p className="text-gray-600 dark:text-gray-400">Preview not available</p>
					</div>
				);
		}
	};

	return (
		<>
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
				<div className="p-2">{renderPreview()}</div>

				{/* Download Button */}
				<div className="p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
					<button
						onClick={async e => {
							e.preventDefault();
							e.stopPropagation();

							try {
								// Download file directly from cloud storage
								const response = await fetch(fileUrl, {
									method: "GET",
									mode: "cors",
								});

								if (!response.ok) {
									throw new Error("Failed to download file");
								}

								// Get the file blob
								const blob = await response.blob();

								// Create download link
								const url = window.URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = fileName;
								document.body.appendChild(link);
								link.click();
								document.body.removeChild(link);
								window.URL.revokeObjectURL(url);
							} catch (error) {
								// Fallback: try to open in new tab
								window.open(fileUrl, "_blank");
							}
						}}
						className="flex items-center justify-center space-x-2 w-full px-3 py-2 text-sm bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
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

			{/* Image Modal */}
			{isImage && (
				<Modal
					isOpen={isImageModalOpen}
					onClose={() => setIsImageModalOpen(false)}
					className="w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] flex items-center justify-center bg-black/90 shadow-none border-none p-8 overflow-hidden"
					showCloseButton={false}
					closeOnBackdropClick={true}
				>
					{/* Image Container */}
					<div className="relative flex items-center justify-center w-full h-full">
						{/* Loader for HEIC conversion */}
						{isModalImageLoading &&
							(fileExtension === "heic" || fileExtension === "heif") && (
								<div className="absolute inset-0 flex items-center justify-center z-20 bg-black/50 rounded-lg">
									<div className="flex flex-col items-center gap-3">
										<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
										<p className="text-sm text-white">Converting HEIC...</p>
									</div>
								</div>
							)}

						{/* Image */}
						{previewContent ? (
							<img
								src={previewContent}
								alt={fileName}
								className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg"
								onClick={e => e.stopPropagation()}
								onLoad={e => {
									// Image loaded successfully, hide loader
									setIsLoading(false);
									setIsModalImageLoading(false);
									// Check if image is already loaded (from cache)
									const target = e.target as HTMLImageElement;
									if (target.complete && target.naturalHeight !== 0) {
										setIsModalImageLoading(false);
									}
								}}
								onError={e => {
									const target = e.target as HTMLImageElement;
									target.style.display = "none";
									setError("Failed to load image");
									setIsModalImageLoading(false);
									setIsImageModalOpen(false);
								}}
								ref={img => {
									// Check if image is already loaded (from cache) when modal opens
									if (img && img.complete && img.naturalHeight !== 0) {
										setIsModalImageLoading(false);
									}
								}}
							/>
						) : (
							<div className="flex items-center justify-center h-64">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
							</div>
						)}
					</div>

					{/* Image Info */}
					<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black/70 rounded-lg text-white text-center backdrop-blur-sm">
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
				fileExtension === "pdf" ||
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

						{fileExtension === "pdf" && (
							<div className="w-full h-full min-h-[600px] border rounded overflow-hidden">
								<iframe
									src={`${fileUrl}#toolbar=1&navpanes=1&scrollbar=1`}
									className="w-full h-full min-h-[600px]"
									title="PDF Preview"
									allow="fullscreen"
									allowFullScreen={true}
								/>
							</div>
						)}

						{(fileExtension === "docx" || fileExtension === "doc") && (
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
		</>
	);
};

export default FilePreview;
