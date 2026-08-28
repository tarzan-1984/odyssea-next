import { S3Uploader } from "@/app-api/S3Uploader";
import { isChatAttachmentNonImageFile } from "@/utils/chatAttachmentTypes";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export type UploadedNewsAttachmentFile = {
	fileUrl: string;
	fileName: string;
	fileSize: number;
};

export function isNewsAttachmentFile(file: File): boolean {
	return isChatAttachmentNonImageFile(file);
}

export async function uploadNewsArticleAttachmentFile(
	file: File,
): Promise<UploadedNewsAttachmentFile> {
	if (!isNewsAttachmentFile(file)) {
		throw new Error("File type not allowed.");
	}
	if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error("File must be 10 MB or smaller.");
	}

	const uploader = new S3Uploader();
	const { fileUrl, fileName, fileSize } = await uploader.upload(file);
	return { fileUrl, fileName, fileSize };
}
