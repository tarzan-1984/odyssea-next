/**
 * Telegram-style chat video prepare for Next:
 * upload original → poster + H.264 on Nest → attach playable URL so mobile opens instantly.
 */

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 30 * 60_000;

export type PreparedChatVideo = {
	fileUrl: string;
	fileName: string;
	fileSize: number;
};

function buildPlayableVideoUrl(fileUrl: string): string | null {
	if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) return null;
	try {
		const parsed = new URL(fileUrl);
		const marker = "/files/";
		const filesIdx = parsed.pathname.indexOf(marker);
		if (filesIdx === -1) return null;
		const afterFiles = parsed.pathname.slice(filesIdx + marker.length);
		if (!afterFiles) return null;
		if (afterFiles.startsWith("playable/") && afterFiles.endsWith("_h264.mp4")) {
			return fileUrl;
		}
		const withoutExt = afterFiles.replace(/\.[^./\\]+$/, "");
		const prefix = parsed.pathname.slice(0, filesIdx + marker.length);
		return `${parsed.origin}${prefix}playable/${withoutExt}_h264.mp4`;
	} catch {
		return null;
	}
}

async function remoteObjectExists(url: string): Promise<boolean> {
	try {
		const head = await fetch(url, { method: "HEAD" });
		if (head.ok) return true;
		const get = await fetch(url, {
			method: "GET",
			headers: { Range: "bytes=0-0" },
		});
		return get.ok || get.status === 206;
	} catch {
		return false;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestPlayable(
	fileUrl: string,
	fileName: string,
): Promise<{ playableUrl: string; playableFileName?: string; playableFileSize?: number; status?: string }> {
	const response = await fetch("/api/storage/video-poster", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fileUrl, fileName, mode: "playable" }),
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(
			(typeof data.error === "string" && data.error) ||
				(typeof data.message === "string" && data.message) ||
				"Failed to prepare video",
		);
	}
	return data;
}

/**
 * After S3 upload: make JPEG poster, wait until Nest H.264 copy is ready, return playable attachment.
 */
export async function prepareChatVideoForSend(
	fileUrl: string,
	fileName: string,
	fileSize: number,
): Promise<PreparedChatVideo> {
	const playableFileName = `${(fileName.replace(/\.[^.]+$/, "") || "video").trim() || "video"}.mp4`;

	await fetch("/api/storage/video-poster", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fileUrl, fileName, mode: "poster" }),
	}).catch(() => undefined);

	const expected = buildPlayableVideoUrl(fileUrl);
	if (expected && (await remoteObjectExists(expected))) {
		return { fileUrl: expected, fileName: playableFileName, fileSize };
	}

	let playableUrl = expected || fileUrl;
	const kicked = await requestPlayable(fileUrl, fileName);
	if (kicked.playableUrl) {
		playableUrl = kicked.playableUrl;
	}
	if (kicked.status === "ready" || (await remoteObjectExists(playableUrl))) {
		return {
			fileUrl: playableUrl,
			fileName: kicked.playableFileName || playableFileName,
			fileSize: kicked.playableFileSize || fileSize,
		};
	}

	const startedAt = Date.now();
	let attempt = 0;
	while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
		attempt += 1;
		if (await remoteObjectExists(playableUrl)) {
			return {
				fileUrl: playableUrl,
				fileName: playableFileName,
				fileSize,
			};
		}
		if (attempt % 12 === 0) {
			try {
				const again = await requestPlayable(fileUrl, fileName);
				if (again.playableUrl) playableUrl = again.playableUrl;
				if (again.status === "ready") {
					return {
						fileUrl: again.playableUrl,
						fileName: again.playableFileName || playableFileName,
						fileSize: again.playableFileSize || fileSize,
					};
				}
			} catch {
				// Keep polling.
			}
		}
		await sleep(POLL_INTERVAL_MS);
	}

	throw new Error("Video conversion timed out. Please try again.");
}
