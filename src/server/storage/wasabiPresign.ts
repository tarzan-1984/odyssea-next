import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const DEFAULT_BUCKET = "tms-chat";
const DEFAULT_PREFIX = "files/";
const DEFAULT_ENDPOINT = "https://s3.eu-central-1.wasabisys.com";
const DEFAULT_REGION = "eu-central-1";

let cachedClient: S3Client | null = null;

function getWasabiConfig() {
	const accessKeyId = process.env.WASABI_ACCESS_KEY?.trim();
	const secretAccessKey = process.env.WASABI_SECRET_KEY?.trim();
	if (!accessKeyId || !secretAccessKey) {
		return null;
	}

	return {
		accessKeyId,
		secretAccessKey,
		bucket: process.env.WASABI_BUCKET?.trim() || DEFAULT_BUCKET,
		prefix: process.env.WASABI_PREFIX?.trim() || DEFAULT_PREFIX,
		endpoint: process.env.WASABI_ENDPOINT?.trim() || DEFAULT_ENDPOINT,
		region: process.env.WASABI_REGION?.trim() || DEFAULT_REGION,
	};
}

function getS3Client(config: NonNullable<ReturnType<typeof getWasabiConfig>>) {
	if (!cachedClient) {
		cachedClient = new S3Client({
			region: config.region,
			endpoint: config.endpoint,
			forcePathStyle: true,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
		});
	}
	return cachedClient;
}

function isAllowedUploadContentType(contentType: string): boolean {
	if (
		contentType.startsWith("image/") ||
		contentType.startsWith("video/") ||
		contentType.startsWith("text/")
	) {
		return true;
	}

	return [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"audio/mpeg",
		"audio/mp3",
		"audio/wav",
		"audio/x-wav",
	].includes(contentType);
}

function makeObjectKey(prefix: string, originalName?: string): string {
	const ext = (originalName?.split(".").pop() || "").toLowerCase();
	const safeExt = ext && ext.length <= 8 ? `.${ext}` : "";
	return `${prefix}${randomUUID()}${safeExt}`;
}

export type WasabiPresignResult = {
	uploadUrl: string;
	fileUrl: string;
	key: string;
};

export function canPresignLocally(): boolean {
	return getWasabiConfig() != null;
}

export async function createWasabiPresignedPut(
	filename?: string,
	contentType?: string,
): Promise<WasabiPresignResult> {
	const config = getWasabiConfig();
	if (!config) {
		throw new Error("Wasabi credentials are not configured.");
	}

	if (filename && filename.length > 255) {
		throw new Error("Filename too long");
	}

	const normalizedContentType = contentType?.split(";")[0]?.trim().toLowerCase();
	if (normalizedContentType && !isAllowedUploadContentType(normalizedContentType)) {
		throw new Error("File type not allowed");
	}

	const key = makeObjectKey(config.prefix, filename);
	const command = new PutObjectCommand({
		Bucket: config.bucket,
		Key: key,
		ContentType: normalizedContentType || "application/octet-stream",
	});

	const uploadUrl = await getSignedUrl(getS3Client(config), command, {
		expiresIn: 600,
	});

	return {
		uploadUrl,
		fileUrl: `${config.endpoint}/${config.bucket}/${key}`,
		key,
	};
}

function parseObjectKeyFromUrl(
	config: NonNullable<ReturnType<typeof getWasabiConfig>>,
	url: string,
): string {
	if (!url || !/^https?:\/\//i.test(url)) {
		throw new Error("Invalid file URL");
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw new Error("Invalid file URL");
	}

	const endpointHost = new URL(config.endpoint).host;
	let key: string | null = null;

	if (parsed.host === endpointHost) {
		const pathParts = parsed.pathname.replace(/^\/+/, "").split("/");
		const [bucket, ...rest] = pathParts;
		if (bucket === config.bucket && rest.length > 0) {
			key = rest.join("/");
		}
	} else if (parsed.host.startsWith(`${config.bucket}.`)) {
		key = parsed.pathname.replace(/^\/+/, "");
	}

	if (!key || !key.startsWith(config.prefix)) {
		throw new Error("File URL key is not allowed");
	}

	return key;
}

export async function deleteWasabiObjectByUrl(url: string): Promise<void> {
	const config = getWasabiConfig();
	if (!config) {
		throw new Error("Wasabi credentials are not configured.");
	}

	const key = parseObjectKeyFromUrl(config, url);
	await getS3Client(config).send(
		new DeleteObjectCommand({
			Bucket: config.bucket,
			Key: key,
		}),
	);
}
