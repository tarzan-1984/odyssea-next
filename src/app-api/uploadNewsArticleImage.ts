import { S3Uploader, type S3UploadProgress } from "@/app-api/S3Uploader";
import {
	formatUploadSizeLabel,
	prepareNewsArticleImageFile,
} from "@/app-api/prepareNewsArticleImageFile";
import { isChatAttachmentImageFile } from "@/utils/chatAttachmentTypes";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export type NewsArticleImageUploadStage =
	| "preparing"
	| S3UploadProgress["stage"];

export type NewsArticleImageUploadProgress = {
	stage: NewsArticleImageUploadStage;
	sizeBytes?: number;
	presignMs?: number;
	putMs?: number;
};

export async function uploadNewsArticleImage(
	file: File,
	onProgress?: (progress: NewsArticleImageUploadProgress) => void,
): Promise<string> {
	if (!isChatAttachmentImageFile(file)) {
		throw new Error("Only image files are allowed.");
	}
	if (file.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error("Image must be 10 MB or smaller.");
	}

	onProgress?.({ stage: "preparing", sizeBytes: file.size });
	const preparedFile = await prepareNewsArticleImageFile(file);

	if (preparedFile.size > MAX_IMAGE_SIZE_BYTES) {
		throw new Error("Image must be 10 MB or smaller.");
	}

	const uploader = new S3Uploader(undefined, {}, progress => onProgress?.(progress));
	const { fileUrl } = await uploader.upload(preparedFile);
	return fileUrl;
}

export function formatNewsArticleUploadStatus(
	progress: NewsArticleImageUploadProgress | null,
): string | null {
	if (!progress) return null;

	switch (progress.stage) {
		case "preparing":
			return "Optimizing image…";
		case "presign":
			return "Requesting upload URL…";
		case "upload":
			if (progress.sizeBytes) {
				return `Uploading to storage (${formatUploadSizeLabel(progress.sizeBytes)})…`;
			}
			return "Uploading to storage…";
		default:
			return null;
	}
}
