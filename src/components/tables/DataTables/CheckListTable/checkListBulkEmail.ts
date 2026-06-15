import type { CheckListDriver } from "./checkListTypes";

export const CHECK_LIST_BULK_EMAIL_BATCH_SIZE = 5;
const CHECK_LIST_BULK_EMAIL_REQUEST_TIMEOUT_MS = 120_000;

export type BulkEmailProgress = {
	completed: number;
	total: number;
};

export type BulkEmailItemResult = {
	driver: CheckListDriver;
	sent: boolean;
	error?: string;
};

export type BulkEmailSummary = {
	sent: number;
	errors: number;
	skipped: number;
	items: BulkEmailItemResult[];
};

function driverShortLabel(driver: CheckListDriver): string {
	const name = `${driver.firstName} ${driver.lastName}`.trim() || "—";
	return driver.externalId ? `${name} (ID: ${driver.externalId})` : name;
}

function buildEmailBody(
	driver: CheckListDriver,
	subject: string,
	message: string,
): Record<string, unknown> {
	const text = message.trim();
	const subj = subject.trim();
	const email = driver.email?.trim();
	const ext = driver.externalId?.trim();
	const body: Record<string, unknown> = {
		subject: subj,
		message: text,
	};
	if (email) {
		body.email = email;
	}
	if (ext) {
		body.externalId = ext;
		body.userId = null;
	} else {
		body.userId = driver.id;
	}
	return body;
}

function chunkDrivers(drivers: CheckListDriver[], batchSize: number): CheckListDriver[][] {
	const chunks: CheckListDriver[][] = [];
	for (let i = 0; i < drivers.length; i += batchSize) {
		chunks.push(drivers.slice(i, i + batchSize));
	}
	return chunks;
}

async function sendOneEmail(
	driver: CheckListDriver,
	subject: string,
	message: string,
	signal?: AbortSignal,
): Promise<BulkEmailItemResult> {
	if (!driver.email?.trim()) {
		return { driver, sent: false, error: "no email address" };
	}

	try {
		const res = await fetch("/api/v1/notifications/email", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			signal,
			body: JSON.stringify(buildEmailBody(driver, subject, message)),
		});
		const json = (await res.json().catch(() => ({}))) as {
			error?: string;
			message?: string;
		};
		if (!res.ok) {
			const msg =
				(typeof json.error === "string" ? json.error : null) ??
				(typeof json.message === "string" ? json.message : null) ??
				"Failed to send email.";
			return { driver, sent: false, error: msg };
		}
		return { driver, sent: true };
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}
		return { driver, sent: false, error: "Network error" };
	}
}

export function formatBulkEmailFailure(item: BulkEmailItemResult): string {
	return `${driverShortLabel(item.driver)}: ${item.error ?? "Failed to send email."}`;
}

export async function bulkSendCheckListEmails(
	drivers: CheckListDriver[],
	subject: string,
	message: string,
	onProgress?: (progress: BulkEmailProgress) => void,
): Promise<BulkEmailSummary> {
	const uniqueDrivers = [
		...new Map(drivers.filter(d => d.id.trim() !== "").map(d => [d.id, d])).values(),
	];
	if (uniqueDrivers.length === 0) {
		return { sent: 0, errors: 0, skipped: 0, items: [] };
	}

	const batches = chunkDrivers(uniqueDrivers, CHECK_LIST_BULK_EMAIL_BATCH_SIZE);
	const items: BulkEmailItemResult[] = [];
	let completed = 0;

	onProgress?.({ completed: 0, total: uniqueDrivers.length });

	for (const batch of batches) {
		const controller = new AbortController();
		const timeoutId = window.setTimeout(
			() => controller.abort(),
			CHECK_LIST_BULK_EMAIL_REQUEST_TIMEOUT_MS,
		);

		try {
			const batchResults = await Promise.all(
				batch.map(driver => sendOneEmail(driver, subject, message, controller.signal)),
			);
			items.push(...batchResults);
			completed += batch.length;
			onProgress?.({ completed, total: uniqueDrivers.length });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new Error(
					`Request timed out after processing ${completed} of ${uniqueDrivers.length} drivers. Please try again with fewer drivers selected.`,
				);
			}
			throw error;
		} finally {
			window.clearTimeout(timeoutId);
		}
	}

	const sent = items.filter(item => item.sent).length;
	const skipped = items.filter(item => item.error === "no email address").length;
	const errors = items.filter(item => !item.sent && item.error !== "no email address").length;

	return { sent, errors, skipped, items };
}
