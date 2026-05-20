export type MessageTemplateScope = "personal" | "company";

export interface MessageTemplateDto {
	id: number;
	externalId: string;
	title: string | null;
	content: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface MessageTemplatesPaginationDto {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasMore: boolean;
}

export interface MessageTemplatesPageDto {
	items: MessageTemplateDto[];
	pagination: MessageTemplatesPaginationDto;
}

/** Raw Nest `TransformInterceptor` payload */
interface NestEnvelope<T> {
	data: T;
	timestamp?: string;
	path?: string;
}

export async function fetchMessageTemplatesPage(params: {
	scope: MessageTemplateScope;
	page: number;
	limit?: number;
	search?: string;
}): Promise<MessageTemplatesPageDto> {
	const limit = params.limit ?? 10;
	const qs = new URLSearchParams({
		scope: params.scope,
		page: String(params.page),
		limit: String(limit),
	});
	if (params.search?.trim()) qs.set("search", params.search.trim());

	const res = await fetch(`/api/message-templates?${qs.toString()}`, {
		method: "GET",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});

	const json = (await res.json().catch(() => ({}))) as NestEnvelope<MessageTemplatesPageDto> & {
		error?: string;
		message?: string;
	};

	if (!res.ok) {
		throw new Error(json.error || json.message || `HTTP ${res.status}`);
	}

	const inner = json.data ?? (json as unknown as MessageTemplatesPageDto);
	if (!inner || !Array.isArray(inner.items) || !inner.pagination) {
		throw new Error("Invalid message templates response");
	}
	return inner;
}

export interface UpsertMessageTemplatePayload {
	id?: number;
	title?: string;
	content?: string;
}

function parseTemplateDto(raw: Record<string, unknown>): MessageTemplateDto {
	const id = raw.id;
	const externalId = raw.externalId;
	if (typeof id !== "number" || typeof externalId !== "string") {
		throw new Error("Invalid message template item");
	}
	return {
		id,
		externalId,
		title: typeof raw.title === "string" ? raw.title : null,
		content: typeof raw.content === "string" ? raw.content : null,
		createdAt:
			typeof raw.createdAt === "string"
				? raw.createdAt
				: raw.createdAt instanceof Date
					? raw.createdAt.toISOString()
					: "",
		updatedAt:
			typeof raw.updatedAt === "string"
				? raw.updatedAt
				: raw.updatedAt instanceof Date
					? raw.updatedAt.toISOString()
					: "",
	};
}

/** POST — omit id to create; include id to update own template. */
export async function upsertMessageTemplate(
	payload: UpsertMessageTemplatePayload
): Promise<MessageTemplateDto> {
	const res = await fetch("/api/message-templates", {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	const json = (await res.json().catch(() => ({}))) as NestEnvelope<Record<string, unknown>> & {
		error?: string;
		message?: string;
	};

	if (!res.ok) {
		throw new Error(json.error || json.message || `HTTP ${res.status}`);
	}

	const inner = json.data ?? (json as unknown as Record<string, unknown>);
	if (!inner || typeof inner !== "object") {
		throw new Error("Invalid message template response");
	}
	return parseTemplateDto(inner as Record<string, unknown>);
}

export async function deleteMessageTemplate(id: number): Promise<{ id: number }> {
	const res = await fetch(`/api/message-templates/${id}`, {
		method: "DELETE",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});

	const json = (await res.json().catch(() => ({}))) as NestEnvelope<{ id: number }> & {
		error?: string;
		message?: string;
	};

	if (!res.ok) {
		throw new Error(json.error || json.message || `HTTP ${res.status}`);
	}

	const inner = json.data ?? (json as unknown as { id?: number });
	if (!inner || typeof inner !== "object" || typeof inner.id !== "number") {
		throw new Error("Invalid delete template response");
	}
	return { id: inner.id };
}
