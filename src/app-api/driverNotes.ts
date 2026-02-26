import axios from "axios";

export interface DriverNotice {
	id?: string | number;
	name?: string;
	date?: string;
	message?: string;
	[key: string]: unknown;
}

export interface DriverNotesResponse {
	/** Array of notices; structure may vary from TMS */
	notices?: DriverNotice[];
	/** Pagination info if TMS returns it */
	total?: number;
	total_pages?: number;
	current_page?: number;
	page?: number;
	per_page?: number;
	[key: string]: unknown;
}

export interface GetDriverNotesParams {
	driverId: string;
	perPage?: number;
	page?: number;
}

export interface PostDriverNoticeParams {
	driverId: string;
	userId: string;
	message: string;
}

const PER_PAGE = 20;

export async function getDriverNotes({
	driverId,
	perPage = PER_PAGE,
	page = 1,
}: GetDriverNotesParams): Promise<DriverNotesResponse> {
	const params = new URLSearchParams();
	params.set("driver_id", driverId);
	params.set("per_page", String(perPage));
	params.set("page", String(page));

	const { data } = await axios.get<DriverNotesResponse>(
		`/api/users/drivers/notes?${params.toString()}`,
		{ withCredentials: true }
	);
	return data;
}

/** POST driver notice (create new note) */
export async function postDriverNotice({
	driverId,
	userId,
	message,
}: PostDriverNoticeParams): Promise<DriverNotesResponse> {
	const response = await axios.post<DriverNotesResponse & { error?: string }>(
		"/api/users/drivers/notes",
		{
			driver_id: Number(driverId),
			id_user: Number(userId),
			message: message.trim(),
		},
		{
			headers: { "Content-Type": "application/json" },
			withCredentials: true,
			validateStatus: () => true,
		}
	);
	const { data, status } = response;
	if (status < 200 || status >= 300) {
		const msg = (data as { error?: string; message?: string })?.error ?? (data as { message?: string })?.message ?? "Failed to create notice";
		throw new Error(typeof msg === "string" ? msg : "Failed to create notice");
	}
	return data as DriverNotesResponse;
}

/** Format date string for display (mm/dd/YY). Handles Unix seconds, ISO strings. */
export function formatNoticeDate(dateStr: string | number | null | undefined): string {
	if (dateStr == null) return "";
	let d: Date;
	if (typeof dateStr === "number" || (typeof dateStr === "string" && /^\d+$/.test(dateStr))) {
		const sec = typeof dateStr === "number" ? dateStr : parseInt(dateStr, 10);
		d = new Date(sec * 1000);
	} else if (typeof dateStr === "string") {
		d = new Date(dateStr.replace(/\s+/, "T"));
	} else {
		return "";
	}
	if (Number.isNaN(d.getTime())) return String(dateStr);
	const mm = (d.getMonth() + 1).toString().padStart(2, "0");
	const dd = d.getDate().toString().padStart(2, "0");
	const yy = d.getFullYear().toString().slice(-2);
	return `${mm}/${dd}/${yy}`;
}
