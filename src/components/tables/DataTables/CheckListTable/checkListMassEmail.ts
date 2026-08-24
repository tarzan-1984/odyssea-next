export type MassEmailJobStatus = "queued" | "running" | "completed" | "failed";

export type MassEmailJobSnapshot = {
	jobId: string;
	status: MassEmailJobStatus;
	total: number;
	processed: number;
	sent: number;
	failed: number;
	skipped: number;
	error?: string;
};

const POLL_INTERVAL_MS = 800;
const POLL_RETRY_ATTEMPTS = 4;

type ApiEnvelope = {
	success?: boolean;
	data?: MassEmailJobSnapshot | { success?: boolean; data?: MassEmailJobSnapshot };
	error?: string;
	message?: string;
};

function isJobSnapshot(value: unknown): value is MassEmailJobSnapshot {
	if (!value || typeof value !== "object") return false;
	const v = value as Record<string, unknown>;
	return typeof v.jobId === "string" && typeof v.status === "string";
}

/** Nest wraps as { data: payload }; controllers often also return { success, data }. */
function unwrapJob(json: unknown): MassEmailJobSnapshot | null {
	let current: unknown = json;
	for (let i = 0; i < 4; i++) {
		if (isJobSnapshot(current)) return current;
		if (!current || typeof current !== "object" || !("data" in current)) break;
		current = (current as { data?: unknown }).data;
	}
	return isJobSnapshot(current) ? current : null;
}

function errorFromPayload(json: ApiEnvelope, fallback: string): string {
	const nested =
		json.data && typeof json.data === "object" && "message" in json.data
			? (json.data as { message?: unknown }).message
			: undefined;
	return (
		(typeof json.error === "string" && json.error) ||
		(typeof json.message === "string" && json.message) ||
		(typeof nested === "string" && nested) ||
		fallback
	);
}

async function parseJobResponse(res: Response, fallback: string): Promise<MassEmailJobSnapshot> {
	const json = (await res.json().catch(() => ({}))) as ApiEnvelope;
	const job = unwrapJob(json);
	if (!res.ok || !job) {
		throw new Error(errorFromPayload(json, fallback));
	}
	return job;
}

export async function startMassEmailBroadcast(
	subject: string,
	message: string,
	signal?: AbortSignal,
): Promise<MassEmailJobSnapshot> {
	const res = await fetch("/api/v1/notifications/email/broadcast", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		signal,
		body: JSON.stringify({ subject, message }),
	});
	return parseJobResponse(res, "Failed to start mass email.");
}

export async function getMassEmailBroadcast(
	jobId: string,
	signal?: AbortSignal,
): Promise<MassEmailJobSnapshot> {
	const res = await fetch(
		`/api/v1/notifications/email/broadcast/${encodeURIComponent(jobId)}`,
		{
			method: "GET",
			credentials: "include",
			signal,
		},
	);
	return parseJobResponse(res, "Failed to load mass email progress.");
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const onAbort = () => {
			window.clearTimeout(timeoutId);
			reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
		};
		const timeoutId = window.setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		if (signal?.aborted) {
			window.clearTimeout(timeoutId);
			onAbort();
			return;
		}
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

async function getMassEmailBroadcastWithRetry(
	jobId: string,
	signal?: AbortSignal,
): Promise<MassEmailJobSnapshot> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= POLL_RETRY_ATTEMPTS; attempt++) {
		try {
			return await getMassEmailBroadcast(jobId, signal);
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw error;
			}
			lastError = error;
			if (attempt < POLL_RETRY_ATTEMPTS) {
				await sleep(400 * attempt, signal);
			}
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Failed to load mass email progress.");
}

export async function watchMassEmailBroadcast(
	jobId: string,
	onProgress: (job: MassEmailJobSnapshot) => void,
	signal?: AbortSignal,
): Promise<MassEmailJobSnapshot> {
	let job = await getMassEmailBroadcastWithRetry(jobId, signal);
	onProgress(job);

	while (job.status === "queued" || job.status === "running") {
		await sleep(POLL_INTERVAL_MS, signal);
		job = await getMassEmailBroadcastWithRetry(jobId, signal);
		onProgress(job);
	}

	return job;
}

export function massEmailProgressPercent(job: MassEmailJobSnapshot): number {
	const total = Number(job.total);
	const processed = Number(job.processed);
	if (!Number.isFinite(total) || total <= 0) {
		return job.status === "completed" || job.status === "failed" ? 100 : 0;
	}
	if (!Number.isFinite(processed) || processed < 0) {
		return 0;
	}
	return Math.min(100, Math.round((processed / total) * 100));
}
