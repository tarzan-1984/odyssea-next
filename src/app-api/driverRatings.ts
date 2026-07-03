import axios from "axios";

export const CANCELED_LOAD_VALUE = "Canceled";

export interface DriverRating {
	id?: string | number;
	name?: string;
	date?: string;
	time?: string | number;
	rating?: number;
	reit?: number;
	load_number?: string;
	order_number?: string;
	message?: string;
	comments?: string;
	[key: string]: unknown;
}

export interface LoadForRating {
	id?: number;
	load_number: string;
	load_status?: string;
	date_created?: string;
	load_type?: string;
	[key: string]: unknown;
}

export interface DriverRatingsResponse {
	success?: boolean;
	data?: {
		driver_id?: number;
		average_rating?: number;
		total_ratings?: number;
		ratings?: DriverRating[];
		total?: number;
		total_pages?: number;
		page?: number;
		per_page?: number;
		has_more?: boolean;
		available_loads?: LoadForRating[];
	};
	ratings?: DriverRating[];
	available_loads?: LoadForRating[];
	total_pages?: number;
	page?: number;
	has_more?: boolean;
	[key: string]: unknown;
}

export interface GetDriverRatingsParams {
	driverId: string;
	userId: string;
	perPage?: number;
	page?: number;
}

export interface PostDriverRatingParams {
	driverId: string;
	userId: string;
	rating: number;
	loadNumber: string;
	comments?: string;
}

const PER_PAGE = 10;

function asRecord(value: unknown): Record<string, unknown> | null {
	return value != null && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function asArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

function getDataRecord(payload: unknown): Record<string, unknown> | null {
	if (!payload || typeof payload !== "object") return null;
	return asRecord((payload as Record<string, unknown>).data);
}

export function extractRatingsFromResponse(payload: unknown): DriverRating[] {
	if (!payload || typeof payload !== "object") return [];
	const root = payload as Record<string, unknown>;
	const data = getDataRecord(payload);

	const candidates = [data?.ratings, root.ratings, data?.all_ratings, root.all_ratings];

	for (const candidate of candidates) {
		const arr = asArray<DriverRating>(candidate);
		if (arr.length > 0) return arr;
	}

	if (Array.isArray(payload)) return payload as DriverRating[];
	return [];
}

export function extractLoadsForRating(payload: unknown): LoadForRating[] {
	if (!payload || typeof payload !== "object") return [];
	const root = payload as Record<string, unknown>;
	const data = getDataRecord(payload);

	const candidates = [data?.available_loads, root.available_loads];

	for (const candidate of candidates) {
		const arr = asArray<Record<string, unknown>>(candidate);
		if (arr.length === 0) continue;
		const loads: LoadForRating[] = [];
		for (const item of arr) {
			const loadNumber = String(item.load_number ?? "").trim();
			if (!loadNumber) continue;
			loads.push({
				id: typeof item.id === "number" ? item.id : undefined,
				load_number: loadNumber,
				load_status:
					typeof item.load_status === "string" ? item.load_status : undefined,
				date_created:
					typeof item.date_created === "string" ? item.date_created : undefined,
				load_type:
					typeof item.load_type === "string" ? item.load_type : undefined,
			});
		}
		return loads;
	}

	return [];
}

export function extractRatingsMeta(payload: unknown): {
	averageRating: number | null;
	totalRatings: number;
} {
	if (!payload || typeof payload !== "object") {
		return { averageRating: null, totalRatings: 0 };
	}
	const root = payload as Record<string, unknown>;
	const data = getDataRecord(payload);
	const avgRaw = data?.average_rating ?? root.average_rating;
	const totalRaw = data?.total_ratings ?? data?.total ?? root.total_ratings ?? root.total;
	const averageRating =
		avgRaw != null && !Number.isNaN(Number(avgRaw)) ? Number(avgRaw) : null;
	const totalRatings = Number(totalRaw) || 0;
	return { averageRating, totalRatings };
}

export function getRatingsPagination(payload: unknown): {
	totalPages: number;
	currentPage: number;
	hasMore: boolean;
} {
	if (!payload || typeof payload !== "object") {
		return { totalPages: 0, currentPage: 1, hasMore: false };
	}
	const root = payload as Record<string, unknown>;
	const data = getDataRecord(payload);
	const totalPages = Number(data?.total_pages ?? root.total_pages ?? 0) || 0;
	const currentPage =
		Number(data?.page ?? root.page ?? data?.current_page ?? root.current_page ?? 1) ||
		1;
	const hasMore = Boolean(data?.has_more ?? root.has_more);
	return { totalPages, currentPage, hasMore };
}

export function formatLoadCreatedDate(
	dateStr: string | null | undefined
): string {
	if (!dateStr) return "";
	const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
	const d = new Date(normalized);
	if (Number.isNaN(d.getTime())) return "";
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	return `${dd}.${mm}.${yyyy}`;
}

export function formatLoadOptionLabel(load: LoadForRating): string {
	const date = formatLoadCreatedDate(load.date_created);
	return date ? `${load.load_number} - ${date}` : load.load_number;
}

export function formatRatingDateTime(
	time: string | number | null | undefined
): string {
	if (time == null || time === "") return "";
	let d: Date;
	if (typeof time === "number" || /^\d+$/.test(String(time))) {
		d = new Date(Number(time) * 1000);
	} else {
		const normalized = String(time).includes("T")
			? String(time)
			: String(time).replace(" ", "T");
		d = new Date(normalized);
	}
	if (Number.isNaN(d.getTime())) return "";
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	const hh = String(d.getHours()).padStart(2, "0");
	const min = String(d.getMinutes()).padStart(2, "0");
	const sec = String(d.getSeconds()).padStart(2, "0");
	return `${dd}.${mm}.${yyyy} ${hh}:${min}:${sec}`;
}

export async function getDriverRatings({
	driverId,
	userId,
	perPage = PER_PAGE,
	page = 1,
}: GetDriverRatingsParams): Promise<DriverRatingsResponse> {
	const params = new URLSearchParams();
	params.set("driver_id", driverId);
	params.set("user_id", userId);
	params.set("per_page", String(perPage));
	params.set("page", String(page));

	const { data } = await axios.get<DriverRatingsResponse>(
		`/api/users/drivers/ratings?${params.toString()}`,
		{ withCredentials: true }
	);
	return data;
}

export async function postDriverRating({
	driverId,
	userId,
	rating,
	loadNumber,
	comments = "",
}: PostDriverRatingParams): Promise<DriverRatingsResponse> {
	const response = await axios.post<DriverRatingsResponse & { error?: string }>(
		"/api/users/drivers/ratings",
		{
			driver_id: Number(driverId),
			user_id: Number(userId),
			rating: Number(rating),
			load_number: loadNumber,
			comments: comments.trim(),
		},
		{
			headers: { "Content-Type": "application/json" },
			withCredentials: true,
			validateStatus: () => true,
		}
	);
	const { data, status } = response;
	if (status < 200 || status >= 300) {
		throw new Error(getPostErrorMessage(data));
	}
	return data as DriverRatingsResponse;
}

export function getRatingValue(rating: DriverRating): number | null {
	const raw = rating.reit ?? rating.rating;
	if (raw == null) return null;
	const num = Number(raw);
	return Number.isFinite(num) && num > 0 ? num : null;
}

export function getAvailableLoadsMessage(count: number): string {
	if (count <= 0) return "No available loads for rating";
	return `${count} available load${count === 1 ? "" : "s"} for rating`;
}

export function computeUpdatedAverageRating(
	previousAvg: number,
	previousCount: number,
	newRating: number
): number {
	if (previousCount <= 0) return newRating;
	return (previousAvg * previousCount + newRating) / (previousCount + 1);
}

function getPostErrorMessage(data: unknown): string {
	if (!data || typeof data !== "object") return "Failed to add rating";
	const root = data as Record<string, unknown>;
	const nested = asRecord(root.data);
	const msg =
		root.error ??
		root.message ??
		nested?.message ??
		nested?.error;
	return typeof msg === "string" && msg.trim() ? msg : "Failed to add rating";
}
