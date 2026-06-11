import {
	CHAT_IMAGE_PREVIEW_MAX_WIDTH,
	CHAT_IMAGE_PREVIEW_QUALITY,
} from "@/config/chatImagePreview";

type EnsureThumbnailResponse = {
	thumbnailUrl: string;
	created?: boolean;
};

export async function ensureChatImageThumbnail(
	fileUrl: string,
	fileName: string,
	options?: { maxWidth?: number; quality?: number }
): Promise<string> {
	const params = new URLSearchParams({
		url: fileUrl,
		fileName,
		w: String(options?.maxWidth ?? CHAT_IMAGE_PREVIEW_MAX_WIDTH),
		q: String(options?.quality ?? CHAT_IMAGE_PREVIEW_QUALITY),
	});

	const response = await fetch(`/api/storage/ensure-thumbnail?${params.toString()}`, {
		method: "GET",
		credentials: "include",
		cache: "no-store",
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			(typeof errorData.error === "string" && errorData.error) ||
				"Failed to ensure chat image thumbnail"
		);
	}

	const data = (await response.json()) as EnsureThumbnailResponse;
	if (!data.thumbnailUrl) {
		throw new Error("Thumbnail URL missing in response");
	}

	return data.thumbnailUrl;
}
