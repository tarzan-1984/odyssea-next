"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import ChatPdfLightbox from "@/components/chats/ChatPdfLightbox";
import { downloadChatFile } from "@/utils/downloadChatFile";
import NewsImageDeleteIcon from "./NewsImageDeleteIcon";

type NewsTextFilePreviewProps = {
	fileUrl: string;
	fileName: string;
	fileSize?: number;
	onDelete?: () => void;
};

function formatFileSizeKb(fileSize?: number): string | null {
	if (!fileSize || fileSize <= 0) return null;
	return `(${Math.round(fileSize / 1024)}KB)`;
}

function getAttachmentExtension(fileName: string): string {
	return fileName.toLowerCase().split(".").pop() ?? "";
}

export default function NewsTextFilePreview({
	fileUrl,
	fileName,
	fileSize,
	onDelete,
}: NewsTextFilePreviewProps) {
	const fileExtension = useMemo(() => getAttachmentExtension(fileName), [fileName]);
	const isPdf = fileExtension === "pdf";
	const isOfficeDoc = fileExtension === "doc" || fileExtension === "docx";

	const [previewContent, setPreviewContent] = useState("");
	const [isLoading, setIsLoading] = useState(!isPdf && !isOfficeDoc);
	const [error, setError] = useState("");
	const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
	const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
	const [isDownloading, setIsDownloading] = useState(false);

	useEffect(() => {
		if (isPdf) {
			setIsLoading(false);
			setError("");
			setPreviewContent("");
			return;
		}

		if (isOfficeDoc) {
			setIsLoading(false);
			setError("");
			setPreviewContent(
				`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`,
			);
			return;
		}

		let cancelled = false;

		const loadPreview = async () => {
			setIsLoading(true);
			setError("");
			setPreviewContent("");

			try {
				const response = await fetch(fileUrl);
				if (!response.ok) {
					throw new Error("Failed to load file preview.");
				}
				const text = await response.text();
				if (!cancelled) {
					setPreviewContent(text);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(
						loadError instanceof Error
							? loadError.message
							: "Failed to load file preview.",
					);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		loadPreview().catch(() => undefined);

		return () => {
			cancelled = true;
		};
	}, [fileUrl, isPdf, isOfficeDoc]);

	const openDocumentModal = useCallback(() => {
		if (isOfficeDoc && previewContent) {
			setIsDocumentModalOpen(true);
			return;
		}
		if (!error && previewContent) {
			setIsDocumentModalOpen(true);
		}
	}, [error, isOfficeDoc, previewContent]);

	const sizeLabel = formatFileSizeKb(fileSize);

	const handleDelete = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		onDelete?.();
	};

	return (
		<>
			<div className="news-text-file-preview group relative mb-2 w-full max-w-[400px] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
				{onDelete ? (
					<button
						type="button"
						className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-md transition-opacity hover:bg-black/75 group-hover:opacity-100 focus-visible:opacity-100"
						onClick={handleDelete}
						aria-label="Remove file"
					>
						<NewsImageDeleteIcon className="h-4 w-4" />
					</button>
				) : null}
				<div className="flex items-center justify-between bg-gray-100 p-2 dark:bg-gray-800">
					<div className="flex min-w-0 items-center space-x-2">
						<svg
							className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<span className="truncate text-sm font-medium text-gray-900 dark:text-white">
							{fileName}
						</span>
						{sizeLabel ? (
							<span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
								{sizeLabel}
							</span>
						) : null}
					</div>
				</div>

				<div className="p-2">
					{isPdf ? (
						<div
							className="group/preview relative h-48 overflow-hidden rounded border border-gray-200 dark:border-gray-700"
						>
							<iframe
								src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
								className="pointer-events-none h-full w-full"
								title="PDF Preview"
							/>
							<button
								type="button"
								className="absolute inset-0 z-10 cursor-pointer bg-transparent transition-colors group-hover/preview:bg-black/5"
								onClick={() => setIsPdfModalOpen(true)}
								aria-label="Open PDF preview"
							/>
						</div>
					) : isOfficeDoc ? (
						<div
							className="group/preview relative h-48 overflow-hidden rounded border border-gray-200 dark:border-gray-700"
						>
							{previewContent ? (
								<iframe
									src={previewContent}
									className="pointer-events-none h-full w-full"
									title="Document preview"
								/>
							) : null}
							<button
								type="button"
								className="absolute inset-0 z-10 cursor-pointer bg-transparent transition-colors group-hover/preview:bg-black/5"
								onClick={openDocumentModal}
								aria-label="Open document preview"
							/>
						</div>
					) : isLoading ? (
						<div className="flex h-32 items-center justify-center">
							<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
						</div>
					) : error ? (
						<div className="flex h-32 items-center justify-center px-2 text-center text-xs text-red-500">
							{error}
						</div>
					) : (
						<div
							className="max-h-48 cursor-pointer overflow-y-auto rounded bg-gray-50 p-2 text-sm transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
							onClick={openDocumentModal}
							onKeyDown={event => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									openDocumentModal();
								}
							}}
							role="button"
							tabIndex={0}
						>
							<pre className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
								{previewContent}
							</pre>
						</div>
					)}
				</div>

				{!onDelete ? (
					<div className="border-t border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
						<button
							type="button"
							disabled={isDownloading}
							onClick={async event => {
								event.preventDefault();
								event.stopPropagation();
								try {
									await downloadChatFile(fileUrl, fileName, {
										onConvertingStart: () => setIsDownloading(true),
										onConvertingEnd: () => setIsDownloading(false),
									});
								} catch {
									setIsDownloading(false);
								}
							}}
							className="flex w-full items-center justify-center space-x-2 rounded bg-brand-500 px-3 py-2 text-sm text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<svg
								className="h-4 w-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden
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
				) : null}
			</div>

			{isPdf ? (
				<ChatPdfLightbox
					isOpen={isPdfModalOpen}
					fileUrl={fileUrl}
					fileName={fileName}
					fileSize={fileSize}
					onClose={() => setIsPdfModalOpen(false)}
				/>
			) : (
				<Modal
					isOpen={isDocumentModalOpen}
					onClose={() => setIsDocumentModalOpen(false)}
					className="flex h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw] flex-col overflow-hidden border-none bg-white p-0 shadow-none dark:bg-gray-900"
					showCloseButton={false}
					closeOnBackdropClick
				>
					<div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
						<div className="flex min-w-0 items-center space-x-2">
							<svg
								className="h-5 w-5 shrink-0 text-gray-600 dark:text-gray-300"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								aria-hidden
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<span className="truncate text-sm font-medium text-gray-900 dark:text-white">
								{fileName}
							</span>
							{sizeLabel ? (
								<span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
									{sizeLabel}
								</span>
							) : null}
						</div>
						<button
							type="button"
							onClick={() => setIsDocumentModalOpen(false)}
							className="flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:h-11 sm:w-11"
							aria-label="Close"
						>
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
									fill="currentColor"
								/>
							</svg>
						</button>
					</div>

					<div className="flex-1 overflow-auto p-4">
						{isOfficeDoc && previewContent ? (
							<iframe
								src={previewContent}
								className="h-full min-h-[70vh] w-full rounded border border-gray-200 dark:border-gray-700"
								title="Document preview"
							/>
						) : (
							<div className="rounded bg-gray-50 p-4 text-sm dark:bg-gray-800">
								<pre className="whitespace-pre-wrap font-mono text-gray-800 dark:text-gray-200">
									{previewContent}
								</pre>
							</div>
						)}
					</div>
				</Modal>
			)}
		</>
	);
}
