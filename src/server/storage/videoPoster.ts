import { spawn } from "child_process";
import { createRequire } from "module";
import { randomUUID } from "crypto";
import { existsSync, promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function resolveFfmpegPath(): string | null {
	const candidates = [
		path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg"),
	];

	try {
		const requireFromCwd = createRequire(path.join(process.cwd(), "package.json"));
		const resolved = requireFromCwd("ffmpeg-static") as string | null;
		if (resolved) candidates.unshift(resolved);
	} catch {
		// Keep cwd fallback below.
	}

	for (const candidate of candidates) {
		if (candidate && existsSync(candidate)) return candidate;
	}
	return null;
}

const ffmpegPath = resolveFfmpegPath();

const POSTER_MAX_WIDTH = 400;
const POSTER_QUALITY_KEY = 50;
const POSTER_TIMEOUT_MS = 25_000;
const PLAYABLE_TIMEOUT_MS = 15 * 60_000;

function wasabiConfig() {
	const accessKeyId = process.env.WASABI_ACCESS_KEY?.trim();
	const secretAccessKey = process.env.WASABI_SECRET_KEY?.trim();
	if (!accessKeyId || !secretAccessKey) return null;
	return {
		accessKeyId,
		secretAccessKey,
		bucket: process.env.WASABI_BUCKET?.trim() || "tms-chat",
		prefix: process.env.WASABI_PREFIX?.trim() || "files/",
		endpoint: process.env.WASABI_ENDPOINT?.trim() || "https://s3.eu-central-1.wasabisys.com",
		region: process.env.WASABI_REGION?.trim() || "eu-central-1",
	};
}

function baseNameFromKey(originalKey: string): string {
	const filesPrefix = "files/";
	let baseName = originalKey.startsWith(filesPrefix)
		? originalKey.slice(filesPrefix.length)
		: originalKey;
	baseName = baseName.replace(/^playable\//, "").replace(/\.[^./\\]+$/, "");
	return baseName.replace(/_h264$/, "");
}

function posterKey(originalKey: string): string {
	return `files/thumbs/${baseNameFromKey(originalKey)}_w${POSTER_MAX_WIDTH}_q${POSTER_QUALITY_KEY}.jpg`;
}

function playableKey(originalKey: string): string {
	return `files/playable/${baseNameFromKey(originalKey)}_h264.mp4`;
}

function objectKeyFromFileUrl(fileUrl: string, bucket: string, endpoint: string, prefix: string): string {
	const parsed = new URL(fileUrl);
	const endpointHost = new URL(endpoint).host;
	let key: string | null = null;
	if (parsed.host === endpointHost) {
		const [urlBucket, ...rest] = parsed.pathname.replace(/^\/+/, "").split("/");
		if (urlBucket === bucket && rest.length > 0) key = rest.join("/");
	} else if (parsed.host.startsWith(`${bucket}.`)) {
		key = parsed.pathname.replace(/^\/+/, "");
	}
	if (!key || !key.startsWith(prefix) || key.includes("..")) {
		throw new Error("File URL key is not allowed");
	}
	return key;
}

function getClient(config: NonNullable<ReturnType<typeof wasabiConfig>>) {
	return new S3Client({
		region: config.region,
		endpoint: config.endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});
}

async function objectExists(
	client: S3Client,
	bucket: string,
	key: string,
): Promise<boolean> {
	try {
		await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch {
		return false;
	}
}

function extractJpeg(sourceUrl: string): Promise<Buffer> {
	if (!ffmpegPath) return Promise.reject(new Error("ffmpeg binary is not available"));
	return new Promise((resolve, reject) => {
		const child = spawn(
			ffmpegPath,
			[
				"-hide_banner",
				"-loglevel",
				"error",
				"-ss",
				"0.5",
				"-i",
				sourceUrl,
				"-frames:v",
				"1",
				"-vf",
				`scale='min(${POSTER_MAX_WIDTH},iw)':-2`,
				"-q:v",
				"5",
				"-f",
				"image2",
				"-vcodec",
				"mjpeg",
				"pipe:1",
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);
		const chunks: Buffer[] = [];
		const errors: Buffer[] = [];
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("Timed out while creating a video poster"));
		}, POSTER_TIMEOUT_MS);
		child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
		child.on("error", error => {
			clearTimeout(timer);
			reject(error);
		});
		child.on("close", code => {
			clearTimeout(timer);
			const jpeg = Buffer.concat(chunks);
			if (code !== 0 || jpeg.length < 100) {
				reject(new Error(Buffer.concat(errors).toString().trim() || `ffmpeg exited ${code}`));
				return;
			}
			resolve(jpeg);
		});
	});
}

async function transcodeToH264(sourceUrl: string): Promise<Buffer> {
	if (!ffmpegPath) throw new Error("ffmpeg binary is not available");
	const outPath = path.join(os.tmpdir(), `chat-h264-${randomUUID()}.mp4`);
	try {
		await new Promise<void>((resolve, reject) => {
			const child = spawn(
				ffmpegPath,
				[
					"-hide_banner",
					"-loglevel",
					"error",
					"-y",
					"-i",
					sourceUrl,
					"-c:v",
					"libx264",
					"-preset",
					"veryfast",
					"-profile:v",
					"main",
					"-level",
					"4.0",
					"-pix_fmt",
					"yuv420p",
					"-vf",
					"scale='min(1280,iw)':-2",
					"-c:a",
					"aac",
					"-b:a",
					"128k",
					"-ac",
					"2",
					"-movflags",
					"+faststart",
					outPath,
				],
				{ stdio: ["ignore", "ignore", "pipe"] },
			);
			const errors: Buffer[] = [];
			const timer = setTimeout(() => {
				child.kill("SIGKILL");
				reject(new Error("Timed out while creating a playable video"));
			}, PLAYABLE_TIMEOUT_MS);
			child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
			child.on("error", error => {
				clearTimeout(timer);
				reject(error);
			});
			child.on("close", code => {
				clearTimeout(timer);
				if (code !== 0) {
					reject(new Error(Buffer.concat(errors).toString().trim() || `ffmpeg exited ${code}`));
					return;
				}
				resolve();
			});
		});
		const buffer = await fs.readFile(outPath);
		if (buffer.length < 1000) throw new Error("Playable video output is empty");
		return buffer;
	} finally {
		await fs.unlink(outPath).catch(() => undefined);
	}
}

export type VideoPrepareResult = {
	thumbnailUrl: string;
	playableUrl: string;
	playableFileName: string;
	playableFileSize: number;
};

function probeIsH264AacMp4(sourceUrl: string): Promise<boolean> {
	if (!ffmpegPath) return Promise.resolve(false);
	return new Promise(resolve => {
		const child = spawn(ffmpegPath, ["-hide_banner", "-i", sourceUrl], {
			stdio: ["ignore", "ignore", "pipe"],
		});
		const errors: Buffer[] = [];
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			resolve(false);
		}, 12_000);
		child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
		child.on("error", () => {
			clearTimeout(timer);
			resolve(false);
		});
		child.on("close", () => {
			clearTimeout(timer);
			const text = Buffer.concat(errors).toString();
			const hasH264 = /Video:\s*h264/i.test(text);
			const hasAac = /Audio:\s*aac/i.test(text) || !/Stream #0:\d+.+: Audio:/i.test(text);
			const isMp4 = /Input #0,\s*(mov|mp4|m4a|3gp|3g2|mj2)/i.test(text);
			resolve(Boolean(hasH264 && hasAac && isMp4));
		});
	});
}

/** Fast path: only the JPEG poster for the chat card. */
export async function storeVideoPosterOnly(fileUrl: string): Promise<{ thumbnailUrl: string }> {
	const config = wasabiConfig();
	if (!config) throw new Error("Wasabi credentials are not configured.");

	const key = objectKeyFromFileUrl(fileUrl, config.bucket, config.endpoint, config.prefix);
	const sourceUrl = `${config.endpoint}/${config.bucket}/${key}`;
	const thumbKey = posterKey(key);
	const client = getClient(config);
	const thumbnailUrl = `${config.endpoint}/${config.bucket}/${thumbKey}`;

	if (!(await objectExists(client, config.bucket, thumbKey))) {
		const jpeg = await extractJpeg(sourceUrl);
		await client.send(
			new PutObjectCommand({
				Bucket: config.bucket,
				Key: thumbKey,
				Body: jpeg,
				ContentType: "image/jpeg",
				CacheControl: "public, max-age=31536000, immutable",
			}),
		);
	}

	return { thumbnailUrl };
}

/**
 * Create H.264 playable copy in the background.
 * Skips re-encode when the original is already H.264/AAC MP4.
 */
export async function prepareChatVideoPlayable(
	fileUrl: string,
	fileName: string,
): Promise<VideoPrepareResult> {
	const config = wasabiConfig();
	if (!config) throw new Error("Wasabi credentials are not configured.");

	const key = objectKeyFromFileUrl(fileUrl, config.bucket, config.endpoint, config.prefix);
	const sourceUrl = `${config.endpoint}/${config.bucket}/${key}`;
	const h264Key = playableKey(key);
	const client = getClient(config);
	const playableFileName = `${(fileName.replace(/\.[^.]+$/, "") || "video").trim() || "video"}.mp4`;

	const { thumbnailUrl } = await storeVideoPosterOnly(fileUrl);

	if (await probeIsH264AacMp4(sourceUrl)) {
		return {
			thumbnailUrl,
			playableUrl: sourceUrl,
			playableFileName,
			playableFileSize: 0,
		};
	}

	let playableUrl = `${config.endpoint}/${config.bucket}/${h264Key}`;
	let playableFileSize = 0;
	if (await objectExists(client, config.bucket, h264Key)) {
		const head = await client.send(
			new HeadObjectCommand({ Bucket: config.bucket, Key: h264Key }),
		);
		playableFileSize = Number(head.ContentLength || 0);
	} else {
		const mp4 = await transcodeToH264(sourceUrl);
		playableFileSize = mp4.length;
		await client.send(
			new PutObjectCommand({
				Bucket: config.bucket,
				Key: h264Key,
				Body: mp4,
				ContentType: "video/mp4",
				CacheControl: "public, max-age=31536000, immutable",
			}),
		);
	}

	const playablePosterKey = posterKey(h264Key);
	if (!(await objectExists(client, config.bucket, playablePosterKey))) {
		const jpeg = await extractJpeg(playableUrl);
		await client.send(
			new PutObjectCommand({
				Bucket: config.bucket,
				Key: playablePosterKey,
				Body: jpeg,
				ContentType: "image/jpeg",
				CacheControl: "public, max-age=31536000, immutable",
			}),
		);
	}

	return {
		thumbnailUrl: `${config.endpoint}/${config.bucket}/${playablePosterKey}`,
		playableUrl,
		playableFileName,
		playableFileSize,
	};
}

/** Full prepare kept for scripts / explicit callers. */
export async function prepareChatVideoForSend(
	fileUrl: string,
	fileName: string,
): Promise<VideoPrepareResult> {
	return prepareChatVideoPlayable(fileUrl, fileName);
}

export async function storeVideoPoster(fileUrl: string): Promise<string> {
	const prepared = await storeVideoPosterOnly(fileUrl);
	return prepared.thumbnailUrl;
}
