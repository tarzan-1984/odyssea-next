"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import {
	tmsLoadFilesQueryKey,
	uploadTmsLoadFiles,
	type TmsLoadUploadFileType,
} from "@/app-api/tmsLoadFiles";
import LoadChatFilePreviewGrid from "@/components/chats/LoadChatFilePreviewGrid";
import { isChatImageFileName } from "@/utils/chatGalleryImages";
export type LoadChatSelectedPhoto = {
	key: string;
	fileUrl: string;
	fileName: string;
	fileSize?: number | null;
};

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;

const UPLOAD_CATEGORIES: {
	fileType: TmsLoadUploadFileType;
	label: string;
	multiple: boolean;
}[] = [
	{ fileType: "other_files", label: "Other files", multiple: true },
	{ fileType: "freight_pictures_pickup", label: "Freight pictures (pick-up)", multiple: true },
	{ fileType: "freight_pictures", label: "Freight pictures (delivery)", multiple: true },
	{ fileType: "pod", label: "Proof Of Delivery", multiple: false },
];

function categoryByType(fileType: string) {
	return UPLOAD_CATEGORIES.find(category => category.fileType === fileType) ?? null;
}

function validationError(fileType: string, files: LoadChatSelectedPhoto[]): string {
	const category = categoryByType(fileType);
	if (!category) return "";
	if (!category.multiple && files.length !== 1) {
		return "Only one file can be uploaded";
	}
	if (files.length > MAX_UPLOAD_FILES) {
		return "You can upload up to 20 files";
	}
	const oversized = files.find(file => (file.fileSize ?? 0) > MAX_UPLOAD_FILE_BYTES);
	if (oversized) return `${oversized.fileName} is larger than 50MB`;
	return "";
}

async function fileFromChatPhoto(photo: LoadChatSelectedPhoto): Promise<File> {
	const response = await fetch(
		`/api/storage/download?url=${encodeURIComponent(photo.fileUrl)}&name=${encodeURIComponent(photo.fileName)}`,
		{ credentials: "include", cache: "no-store" }
	);
	if (!response.ok) {
		throw new Error(`Failed to read ${photo.fileName}`);
	}
	const blob = await response.blob();
	const disposition = response.headers.get("Content-Disposition") ?? "";
	const named = /filename="([^"]+)"/.exec(disposition)?.[1];
	return new File([blob], named || photo.fileName, {
		type: blob.type || "application/octet-stream",
	});
}

export default function LoadChatPhotoUploadModal({
	isOpen,
	files,
	loadId,
	onClose,
	onUploaded,
	onRemoveFile,
}: {
	isOpen: boolean;
	files: LoadChatSelectedPhoto[];
	loadId: string;
	onClose: () => void;
	onUploaded: (keys: string[]) => void;
	onRemoveFile: (key: string) => void;
}) {
	const queryClient = useQueryClient();
	const [fileType, setFileType] = useState("");
	const [error, setError] = useState("");
	const [isSending, setIsSending] = useState(false);

	useEffect(() => {
		if (!isOpen) {
			setFileType("");
			setError("");
			setIsSending(false);
		}
	}, [isOpen]);

	const categoryError = validationError(fileType, files);
	const canSend = Boolean(fileType) && !categoryError && files.length > 0 && !isSending;

	const send = async () => {
		if (!canSend) return;
		const trimmedLoadId = loadId.trim();
		if (!trimmedLoadId) {
			setError("Load id is missing");
			return;
		}
		setIsSending(true);
		setError("");
		try {
			const uploaded = await Promise.all(files.map(fileFromChatPhoto));
			await uploadTmsLoadFiles(trimmedLoadId, fileType as TmsLoadUploadFileType, uploaded);
			await queryClient.invalidateQueries({ queryKey: tmsLoadFilesQueryKey(trimmedLoadId) });
			onUploaded(files.map(file => file.key));
			onClose();
		} catch (sendError) {
			setError(sendError instanceof Error ? sendError.message : "Failed to upload files");
			setIsSending(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick={!isSending}
			closeOnEscape={!isSending}
		>
			<div className="px-5 pb-6 pt-6 sm:px-6 sm:pt-7">
				<h2 className="pr-10 text-lg font-semibold text-gray-900 dark:text-white">Upload files</h2>
				<label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
					Category
					<div className="relative mt-1.5">
						<select
							value={fileType}
							disabled={isSending}
							onChange={event => setFileType(event.target.value)}
							className="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
						>
							<option value="">Select a category</option>
							{UPLOAD_CATEGORIES.map(category => (
								<option key={category.fileType} value={category.fileType}>
									{category.label}
								</option>
							))}
						</select>
						<svg
							viewBox="0 0 20 20"
							aria-hidden
							className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-300"
						>
							<path
								d="M5.5 7.5 10 12l4.5-4.5"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</div>
				</label>
				{fileType ? (
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						{categoryByType(fileType)?.multiple ? "Up to 20 files" : "One file"}
					</p>
				) : null}
				{categoryError ? <p className="mt-2 text-sm text-red-500">{categoryError}</p> : null}
				{error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
				<LoadChatFilePreviewGrid
					items={files.map(file => ({
						key: file.key,
						name: file.fileName,
						previewUrl: isChatImageFileName(file.fileName) ? file.fileUrl : null,
						fileUrl: file.fileUrl,
						onRemove: isSending ? undefined : () => onRemoveFile(file.key),
					}))}
				/>
				<div className="mt-5 flex justify-end">
					<button
						type="button"
						disabled={!canSend}
						onClick={() => {
							void send();
						}}
						className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSending ? "Sending..." : "Send"}
					</button>
				</div>
			</div>
		</Modal>
	);
}
