export const TMS_LOAD_FILES_STALE_TIME_MS = 5 * 60 * 1000;

export type TmsLoadFile = {
	id: number;
	url: string;
	filename: string;
	mime_type: string;
	filesize: number;
};

export type TmsLoadFilesData = {
	load_id: number;
	project: string;
	is_flt: boolean;
	reference_number?: string;
	other_files?: TmsLoadFile[] | null;
	proof_of_delivery?: TmsLoadFile | null;
	rate_confirmation?: TmsLoadFile | TmsLoadFile[] | null;
	updated_rate_confirmation?: TmsLoadFile | TmsLoadFile[] | null;
	freight_pictures?: TmsLoadFile[] | null;
	freight_pictures_pickup?: TmsLoadFile[] | null;
	freight_pictures_delivery?: TmsLoadFile[] | null;
};

export function tmsLoadFilesQueryKey(loadId: string) {
	return ["tms", "load-files", loadId.trim()] as const;
}

function isTmsLoadFile(value: unknown): value is TmsLoadFile {
	if (!value || typeof value !== "object") return false;
	const file = value as Partial<TmsLoadFile>;
	return typeof file.url === "string" && file.url.trim().length > 0;
}

export function tmsLoadFileList(value: unknown): TmsLoadFile[] {
	if (!value) return [];
	const items = Array.isArray(value) ? value : [value];
	return items.filter(isTmsLoadFile);
}

export type TmsLoadUploadFileType =
	| "pod"
	| "freight_pictures"
	| "freight_pictures_pickup"
	| "other_files";

export async function uploadTmsLoadFiles(
	loadId: string,
	fileType: TmsLoadUploadFileType,
	files: File[]
): Promise<void> {
	const body = new FormData();
	body.append("file_type", fileType);
	for (const file of files) {
		body.append("files[]", file, file.name);
	}

	const response = await fetch(`/api/tms/load/${encodeURIComponent(loadId.trim())}/files`, {
		method: "POST",
		credentials: "include",
		body,
	});

	const payload = (await response.json().catch(() => null)) as
		| { success?: boolean; error?: string; message?: string }
		| null;

	if (!response.ok || payload?.success === false) {
		throw new Error(payload?.error || payload?.message || "Failed to upload files");
	}
}

export async function fetchTmsLoadFiles(loadId: string): Promise<TmsLoadFilesData> {
	const trimmed = loadId.trim();
	const response = await fetch(`/api/tms/load/${encodeURIComponent(trimmed)}/files`, {
		method: "GET",
		credentials: "include",
		cache: "no-store",
	});

	const body = (await response.json().catch(() => null)) as
		| { success?: boolean; data?: TmsLoadFilesData; error?: string; message?: string }
		| null;

	if (!response.ok || body?.success === false || !body?.data) {
		throw new Error(body?.error || body?.message || "Failed to load files");
	}

	return body.data;
}
