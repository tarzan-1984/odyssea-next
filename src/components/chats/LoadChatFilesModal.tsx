"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { AddLoadFileIcon } from "@/icons";
import LoadChatFilePreviewGrid from "@/components/chats/LoadChatFilePreviewGrid";
import type { Message } from "@/app-api/chatApi";
import FilePreview from "@/components/chats/FilePreview";
import { ChatImageGalleryProvider } from "@/components/chats/ChatImageGalleryContext";
import { useLoadChatReferenceNumber } from "@/components/chats/LoadChatDownloadContext";
import { loadReferenceDownloadFilename } from "@/utils/downloadChatFile";
import { ChatMediaLoadProvider } from "@/context/ChatMediaLoadContext";
import {
	fetchTmsLoadFiles,
	TMS_LOAD_FILES_STALE_TIME_MS,
	tmsLoadFileList,
	tmsLoadFilesQueryKey,
	uploadTmsLoadFiles,
	type TmsLoadFile,
	type TmsLoadFilesData,
	type TmsLoadUploadFileType,
} from "@/app-api/tmsLoadFiles";

const LOAD_CHAT_FILE_TABS = [
	{ id: "other", label: "Other files" },
	{ id: "pickup", label: "Freight pictures (pick-up)" },
	{ id: "delivery", label: "Freight pictures (delivery)" },
	{ id: "rate-confirmation", label: "Rate confirmation" },
	{ id: "pod", label: "Proof Of Delivery" },
] as const;

type LoadChatFileTabId = (typeof LOAD_CHAT_FILE_TABS)[number]["id"];

type LoadChatFilesModalProps = {
	isOpen: boolean;
	onClose: () => void;
	loadId?: string | null;
};

function proofOfDeliveryFile(data: TmsLoadFilesData | undefined): TmsLoadFile | null {
	return tmsLoadFileList(data?.proof_of_delivery)[0] ?? null;
}

function pickupFiles(data: TmsLoadFilesData | undefined): TmsLoadFile[] {
	return tmsLoadFileList(data?.freight_pictures_pickup);
}

function deliveryFiles(data: TmsLoadFilesData | undefined): TmsLoadFile[] {
	return tmsLoadFileList(data?.freight_pictures);
}

function otherFiles(data: TmsLoadFilesData | undefined): TmsLoadFile[] {
	return tmsLoadFileList(data?.other_files);
}

function rateConfirmationFiles(data: TmsLoadFilesData | undefined): TmsLoadFile[] {
	const files = [
		...tmsLoadFileList(data?.rate_confirmation),
		...tmsLoadFileList(data?.updated_rate_confirmation),
	];
	const seen = new Set<string>();
	return files.filter(file => {
		const key = file.url.trim();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function tmsLoadFileName(file: TmsLoadFile): string {
	const name = file.filename?.trim();
	if (name) return name;
	try {
		const base = decodeURIComponent(new URL(file.url).pathname.split("/").pop() || "");
		return base || "file";
	} catch {
		return "file";
	}
}

function LoadChatFileCard({ file }: { file: TmsLoadFile }) {
	const loadReferenceNumber = useLoadChatReferenceNumber();
	const [isDownloading, setIsDownloading] = useState(false);
	const fileName = tmsLoadFileName(file);
	const sizeLabel =
		file.filesize > 0 ? `${Math.round(file.filesize / 1024)}KB` : "";

	return (
		<div className="relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-800">
			<div className="absolute inset-0">
				<FilePreview
					compact
					square
					allowEdit={false}
					fileUrl={file.url}
					fileName={fileName}
					fileSize={file.filesize}
				/>
			</div>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-1.5 pb-1.5 pt-8">
				<p className="truncate text-[11px] font-medium text-white" title={fileName}>
					{fileName}
				</p>
				{sizeLabel ? <p className="text-[10px] text-white/70">{sizeLabel}</p> : null}
				<button
					type="button"
					disabled={isDownloading}
					onClick={e => {
						e.preventDefault();
						e.stopPropagation();
						void import("@/utils/downloadChatFile").then(({ downloadChatFile }) =>
							downloadChatFile(file.url, fileName, {
								downloadName:
									loadReferenceDownloadFilename(
										loadReferenceNumber,
										fileName,
										file.url
									) ?? undefined,
								onConvertingStart: () => setIsDownloading(true),
								onConvertingEnd: () => setIsDownloading(false),
							}).catch(() => setIsDownloading(false))
						);
					}}
					className="pointer-events-auto mt-1 flex w-full items-center justify-center gap-1 rounded bg-brand-500 px-1 py-1 text-[10px] font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
				>
					Download
				</button>
			</div>
		</div>
	);
}

function LoadChatFileCards({ files }: { files: TmsLoadFile[] }) {
	const galleryMessages = useMemo(
		() =>
			files.map(file => ({
				id: String(file.id),
				fileUrl: file.url,
				fileName: tmsLoadFileName(file),
				fileSize: file.filesize,
			})) as Message[],
		[files]
	);

	return (
		<ChatImageGalleryProvider messages={galleryMessages}>
			<ChatMediaLoadProvider mediaLoadEnabled scrollRoot={null}>
				<div className="grid grid-cols-3 gap-2">
					{files.map(file => (
						<LoadChatFileCard key={`${file.id}-${file.url}`} file={file} />
					))}
				</div>
			</ChatMediaLoadProvider>
		</ChatImageGalleryProvider>
	);
}

const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
const UPLOAD_EXTENSIONS = new Set([
	"jpg",
	"jpeg",
	"png",
	"gif",
	"webp",
	"pdf",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"csv",
	"txt",
	"heic",
	"heif",
]);

const TAB_UPLOAD: Record<
	Exclude<LoadChatFileTabId, "rate-confirmation">,
	{ fileType: TmsLoadUploadFileType; multiple: boolean }
> = {
	other: { fileType: "other_files", multiple: true },
	pickup: { fileType: "freight_pictures_pickup", multiple: true },
	delivery: { fileType: "freight_pictures", multiple: true },
	pod: { fileType: "pod", multiple: false },
};

function fileKey(file: File): string {
	return `${file.name}-${file.size}-${file.lastModified}`;
}

function fileExtension(name: string): string {
	return name.toLowerCase().split(".").pop() || "";
}

function LoadChatAddFileModal({
	isOpen,
	onClose,
	loadId,
	fileType,
	multiple,
	onUploaded,
}: {
	isOpen: boolean;
	onClose: () => void;
	loadId: string;
	fileType: TmsLoadUploadFileType;
	multiple: boolean;
	onUploaded: () => void;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [files, setFiles] = useState<File[]>([]);
	const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
	const [isDragging, setIsDragging] = useState(false);
	const [error, setError] = useState("");
	const [isUploading, setIsUploading] = useState(false);

	useEffect(() => {
		const next: Record<string, string> = {};
		for (const file of files) {
			const extension = fileExtension(file.name);
			if (!["jpg", "jpeg", "png", "gif", "webp", "pdf", "txt"].includes(extension)) continue;
			next[fileKey(file)] = URL.createObjectURL(file);
		}
		setPreviewUrls(next);
		return () => {
			for (const url of Object.values(next)) URL.revokeObjectURL(url);
		};
	}, [files]);

	useEffect(() => {
		if (!isOpen) {
			setFiles([]);
			setIsDragging(false);
			setError("");
			setIsUploading(false);
		}
	}, [isOpen]);

	const addFiles = (list: FileList | File[]) => {
		const incoming = Array.from(list);
		if (incoming.length === 0) return;

		const rejected: string[] = [];
		const accepted = incoming.filter(file => {
			if (!UPLOAD_EXTENSIONS.has(fileExtension(file.name))) {
				rejected.push(`${file.name} is not a supported file`);
				return false;
			}
			if (file.size > MAX_UPLOAD_FILE_BYTES) {
				rejected.push(`${file.name} is larger than 50MB`);
				return false;
			}
			return true;
		});

		if (!multiple) {
			if (incoming.length > 1) rejected.unshift("Only one file can be uploaded");
			setFiles(accepted.slice(0, 1));
			setError(rejected[0] ?? "");
			return;
		}

		setFiles(prev => {
			const seen = new Set(prev.map(fileKey));
			const next = [...prev];
			for (const file of accepted) {
				const key = fileKey(file);
				if (seen.has(key)) continue;
				if (next.length >= MAX_UPLOAD_FILES) {
					rejected.push("You can upload up to 20 files");
					break;
				}
				seen.add(key);
				next.push(file);
			}
			return next;
		});
		setError(rejected[0] ?? "");
	};

	const upload = async () => {
		if (files.length === 0 || isUploading) return;
		setIsUploading(true);
		setError("");
		try {
			await uploadTmsLoadFiles(loadId, fileType, files);
			onUploaded();
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : "Failed to upload files");
			setIsUploading(false);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
		>
			<div className="px-5 pb-6 pt-6 sm:px-6 sm:pt-7">
				<h2 className="pr-10 text-lg font-semibold text-gray-900 dark:text-white">Add file</h2>
				<input
					ref={inputRef}
					type="file"
					multiple={multiple}
					disabled={isUploading}
					className="sr-only"
					onChange={event => {
						addFiles(event.target.files ?? []);
						event.target.value = "";
					}}
				/>
				<div
					role="button"
					tabIndex={0}
					onClick={() => inputRef.current?.click()}
					onKeyDown={event => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							inputRef.current?.click();
						}
					}}
					onDragEnter={event => {
						event.preventDefault();
						setIsDragging(true);
					}}
					onDragOver={event => {
						event.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={event => {
						event.preventDefault();
						setIsDragging(false);
					}}
					onDrop={event => {
						event.preventDefault();
						setIsDragging(false);
						addFiles(event.dataTransfer.files);
					}}
					className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
						isDragging
							? "border-brand-500 bg-brand-500/10"
							: "border-gray-300 bg-gray-50 hover:border-brand-400 dark:border-gray-700 dark:bg-gray-800/40"
					}`}
				>
					<AddLoadFileIcon className="h-8 w-8 text-brand-500" />
					<p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">
						Drag and drop files here
					</p>
					<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
						{multiple ? "or click to browse, up to 20 files" : "or click to browse, one file"}
					</p>
				</div>
				{error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
				<LoadChatFilePreviewGrid
					items={files.map(file => {
						const key = fileKey(file);
						const extension = fileExtension(file.name);
						const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(extension);
						return {
							key,
							name: file.name,
							previewUrl: isImage ? previewUrls[key] : null,
							fileUrl: previewUrls[key],
							onRemove: () => setFiles(prev => prev.filter(item => fileKey(item) !== key)),
						};
					})}
				/>
				<div className="mt-5 flex justify-end">
					<button
						type="button"
						disabled={files.length === 0 || isUploading}
						onClick={() => {
							void upload();
						}}
						className="inline-flex items-center rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isUploading ? "Uploading..." : "Upload"}
					</button>
				</div>
			</div>
		</Modal>
	);
}

function EmptyFiles() {
	return (
		<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No files</p>
	);
}

export default function LoadChatFilesModal({ isOpen, onClose, loadId }: LoadChatFilesModalProps) {
	const [activeTab, setActiveTab] = useState<LoadChatFileTabId>(LOAD_CHAT_FILE_TABS[0].id);
	const [isAddFileOpen, setIsAddFileOpen] = useState(false);
	const queryClient = useQueryClient();
	// Keep visited tabs mounted so image previews are not fetched again on each switch.
	const [visitedTabs, setVisitedTabs] = useState<LoadChatFileTabId[]>([LOAD_CHAT_FILE_TABS[0].id]);
	const trimmedLoadId = loadId?.trim() ?? "";

	useEffect(() => {
		if (!isOpen) {
			setActiveTab(LOAD_CHAT_FILE_TABS[0].id);
			setVisitedTabs([LOAD_CHAT_FILE_TABS[0].id]);
			setIsAddFileOpen(false);
		}
	}, [isOpen]);

	const selectTab = (tabId: LoadChatFileTabId) => {
		setActiveTab(tabId);
		setVisitedTabs(prev => (prev.includes(tabId) ? prev : [...prev, tabId]));
	};

	const filesQuery = useQuery({
		queryKey: tmsLoadFilesQueryKey(trimmedLoadId || "missing"),
		queryFn: () => fetchTmsLoadFiles(trimmedLoadId),
		enabled: isOpen && trimmedLoadId.length > 0,
		staleTime: TMS_LOAD_FILES_STALE_TIME_MS,
		gcTime: TMS_LOAD_FILES_STALE_TIME_MS,
	});

	const podFile = proofOfDeliveryFile(filesQuery.data);
	const pickupPictureFiles = pickupFiles(filesQuery.data);
	const deliveryPictureFiles = deliveryFiles(filesQuery.data);
	const otherFileList = otherFiles(filesQuery.data);
	const rateConfirmationFileList = rateConfirmationFiles(filesQuery.data);
	const uploadConfig = activeTab === "rate-confirmation" ? null : TAB_UPLOAD[activeTab];

	const renderTabFiles = (tabId: LoadChatFileTabId) => {
		if (tabId === "pod") return podFile ? <LoadChatFileCards files={[podFile]} /> : <EmptyFiles />;
		if (tabId === "pickup") {
			return pickupPictureFiles.length > 0 ? (
				<LoadChatFileCards files={pickupPictureFiles} />
			) : (
				<EmptyFiles />
			);
		}
		if (tabId === "other") {
			return otherFileList.length > 0 ? <LoadChatFileCards files={otherFileList} /> : <EmptyFiles />;
		}
		if (tabId === "delivery") {
			return deliveryPictureFiles.length > 0 ? (
				<LoadChatFileCards files={deliveryPictureFiles} />
			) : (
				<EmptyFiles />
			);
		}
		return rateConfirmationFileList.length > 0 ? (
			<LoadChatFileCards files={rateConfirmationFileList} />
		) : (
			<EmptyFiles />
		);
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			className="w-full max-w-[56rem] rounded-xl bg-white shadow-xl dark:bg-gray-900"
			closeOnBackdropClick
			closeOnEscape={!isAddFileOpen}
		>
			<div className="px-5 pb-6 pt-6 sm:px-6 sm:pt-7">
				<h2 className="pr-10 text-lg font-semibold text-gray-900 dark:text-white">Files</h2>
				<div className="mt-4 border-b border-gray-200 dark:border-gray-800">
					<div
						role="tablist"
						aria-label="Load files"
						className="-mb-px flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600"
					>
						{LOAD_CHAT_FILE_TABS.map(tab => {
							const isActive = activeTab === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									role="tab"
									id={`load-files-tab-${tab.id}`}
									aria-selected={isActive}
									aria-controls={`load-files-panel-${tab.id}`}
									onClick={() => selectTab(tab.id)}
									className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
										isActive
											? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400"
											: "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
									}`}
								>
									{tab.label}
								</button>
							);
						})}
					</div>
				</div>
				{trimmedLoadId && uploadConfig && !filesQuery.isPending && !filesQuery.isError ? (
					<button
						type="button"
						onClick={() => setIsAddFileOpen(true)}
						className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
					>
						<AddLoadFileIcon className="h-4 w-4" />
						Add file
					</button>
				) : null}
				<div className="min-h-48 max-h-96 overflow-y-auto pt-3">
					{!trimmedLoadId ? (
						<p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
							Load id is missing.
						</p>
					) : filesQuery.isPending ? (
						<div className="flex justify-center py-8">
							<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
						</div>
					) : filesQuery.isError ? (
						<p className="py-8 text-center text-sm text-red-500">
							{filesQuery.error instanceof Error
								? filesQuery.error.message
								: "Failed to load files"}
						</p>
					) : (
						visitedTabs.map(tabId => (
							<div
								key={tabId}
								role="tabpanel"
								id={`load-files-panel-${tabId}`}
								aria-labelledby={`load-files-tab-${tabId}`}
								hidden={tabId !== activeTab}
							>
								{renderTabFiles(tabId)}
							</div>
						))
					)}
				</div>
			</div>
			{uploadConfig ? (
				<LoadChatAddFileModal
					isOpen={isAddFileOpen}
					onClose={() => setIsAddFileOpen(false)}
					loadId={trimmedLoadId}
					fileType={uploadConfig.fileType}
					multiple={uploadConfig.multiple}
					onUploaded={() => {
						setIsAddFileOpen(false);
						void queryClient.invalidateQueries({
							queryKey: tmsLoadFilesQueryKey(trimmedLoadId),
						});
					}}
				/>
			) : null}
		</Modal>
	);
}
