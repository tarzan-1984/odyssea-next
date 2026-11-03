"use client";

import React, { useState } from "react";
import type { ChatMessageAttachment } from "@/app-api/chatApi";
import FilePreview from "@/components/chats/FilePreview";
import { HeicConvertingOverlay } from "@/components/chats/HeicConvertingOverlay";
import { isHeicFileName, loadReferenceDownloadFilename } from "@/utils/downloadChatFile";
import { isLoadChatSelectableFileName } from "@/utils/chatGalleryImages";
import { useLoadChatReferenceNumber } from "@/components/chats/LoadChatDownloadContext";
import {
	useLoadChatPhotoSelection,
	type LoadChatSelectedPhoto,
} from "@/components/chats/LoadChatPhotoSelectionContext";

function formatKb(size?: number | null): string {
	if (size == null || Number.isNaN(size)) return "";
	return `${Math.round(Number(size) / 1024)}KB`;
}

async function downloadFile(
	fileUrl: string,
	fileName: string,
	hooks?: {
		onConvertingStart?: () => void;
		onConvertingEnd?: () => void;
		downloadName?: string;
	}
) {
	const { downloadChatFile } = await import("@/utils/downloadChatFile");
	await downloadChatFile(fileUrl, fileName, hooks);
}

interface MessageAttachmentsGridProps {
	items: ChatMessageAttachment[];
	isOutgoing?: boolean;
	messageId?: string;
}

interface MessageAttachmentCardProps {
	item: ChatMessageAttachment;
	itemKey: string;
	isOutgoing?: boolean;
	downloadingKey: string | null;
	setDownloadingKey: React.Dispatch<React.SetStateAction<string | null>>;
}

export const MESSAGE_ATTACHMENT_CARD_WIDTH_CLASS = "w-[149px]";
export const MESSAGE_ATTACHMENT_GRID_CLASS =
	"grid w-full items-stretch gap-2 grid-cols-[repeat(2,minmax(0,149px))]";
export const MESSAGE_ATTACHMENT_GRID_THREE_CLASS =
	"md:grid-cols-[repeat(3,minmax(0,149px))]";

export function MessageAttachmentCard({
	item,
	itemKey,
	isOutgoing = false,
	downloadingKey,
	setDownloadingKey,
}: MessageAttachmentCardProps) {
	const loadReferenceNumber = useLoadChatReferenceNumber();
	const kb = formatKb(item.fileSize);
	const safeName = item.fileName || "File";
	const isHeic = isHeicFileName(safeName, item.fileUrl);
	const isDownloadingThis = downloadingKey === itemKey;
	const photoSelection = useLoadChatPhotoSelection();
	const canSelectFile = Boolean(photoSelection) && isLoadChatSelectableFileName(safeName);
	const isFileSelected = canSelectFile && Boolean(photoSelection?.isSelected(itemKey));

	const cellFrame = isOutgoing
		? "rounded-lg border border-white/20 bg-white/10"
		: "rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800";

	const nameCls = isOutgoing
		? "text-xs font-medium text-white truncate"
		: "text-xs font-medium text-gray-900 dark:text-white truncate";

	const metaCls = isOutgoing
		? "text-[10px] text-white/70"
		: "text-[10px] text-gray-500 dark:text-gray-400";

	const downloadBtnCls =
		"flex w-full shrink-0 items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors";

	return (
		<div className={`${cellFrame} relative flex h-full min-h-0 flex-col overflow-hidden`}>
			{isDownloadingThis && isHeic && (
				<HeicConvertingOverlay className="z-30 rounded-lg" message="Converting HEIC..." />
			)}
			<div className="relative shrink-0">
				<FilePreview
					compact
					fileUrl={item.fileUrl}
					fileName={safeName}
					fileSize={item.fileSize}
				/>
				{canSelectFile ? (
					<button
						type="button"
						role="checkbox"
						aria-checked={isFileSelected}
						aria-label={`${isFileSelected ? "Deselect" : "Select"} ${safeName}`}
						onMouseDown={event => event.stopPropagation()}
						onClick={event => {
							event.preventDefault();
							event.stopPropagation();
							photoSelection?.toggle(itemKey);
						}}
						className={`absolute right-1.5 top-1.5 z-20 flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border shadow-sm ${
							isFileSelected
								? "border-brand-500 bg-brand-500 text-white"
								: "border-gray-800 bg-white/90 text-transparent"
						}`}
					>
						<svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
							<path
								d="M3.5 8.2 6.4 11l6.1-6.2"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				) : null}
			</div>
			<div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1 pt-1">
				<div className="min-h-0">
					<p className={nameCls} title={item.fileName}>
						{safeName}
					</p>
					{kb ? <p className={metaCls}>{kb}</p> : null}
				</div>
				<button
					type="button"
					disabled={isDownloadingThis}
					onClick={e => {
						e.preventDefault();
						e.stopPropagation();
						downloadFile(item.fileUrl, safeName, {
							downloadName:
								loadReferenceDownloadFilename(
									loadReferenceNumber,
									safeName,
									item.fileUrl
								) ?? undefined,
							onConvertingStart: () => setDownloadingKey(itemKey),
							onConvertingEnd: () => setDownloadingKey(null),
						}).catch(() => setDownloadingKey(null));
					}}
					className={`${downloadBtnCls} mt-auto disabled:cursor-not-allowed disabled:opacity-60`}
				>
					<svg
						className="h-3 w-3"
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
					Download
				</button>
			</div>
		</div>
	);
}

/**
 * Desktop (md+): 3 columns when 4+ files. Mobile: always at most 2 columns per row.
 */
export default function MessageAttachmentsGrid({
	items,
	isOutgoing = false,
	messageId,
}: MessageAttachmentsGridProps) {
	const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

	if (!items?.length) return null;

	const useThreeColumns = items.length > 3;

	const gridClass = [
		MESSAGE_ATTACHMENT_GRID_CLASS,
		useThreeColumns ? MESSAGE_ATTACHMENT_GRID_THREE_CLASS : "",
	].join(" ");

	return (
		<div className={gridClass}>
			{items.map((a, idx) => {
				const key = `${messageId ?? "file"}:${idx}:${a.fileUrl}`;
				return (
					<MessageAttachmentCard
						key={key}
						item={a}
						itemKey={key}
						isOutgoing={isOutgoing}
						downloadingKey={downloadingKey}
						setDownloadingKey={setDownloadingKey}
					/>
				);
			})}
		</div>
	);
}

export function LoadChatSelectedPhotosUploadButton({
	files,
	isOutgoing = false,
}: {
	files: LoadChatSelectedPhoto[];
	isOutgoing?: boolean;
}) {
	const selection = useLoadChatPhotoSelection();
	if (!selection || files.length === 0) return null;

	const selectedFiles = files.filter(file => selection.isSelected(file.key));
	if (selectedFiles.length === 0) return null;

	return (
		<button
			type="button"
			onMouseDown={event => event.stopPropagation()}
			onClick={event => {
				event.preventDefault();
				event.stopPropagation();
				selection.openUpload(selectedFiles);
			}}
			className={`inline-flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
				isOutgoing
					? "bg-white text-brand-600 hover:bg-white/90"
					: "bg-brand-500 text-white hover:bg-brand-600"
			}`}
		>
			{selectedFiles.length === 1 ? "Upload file" : "Upload files"}
		</button>
	);
}
