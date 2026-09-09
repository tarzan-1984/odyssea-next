const LOAD_CHAT_STATUS_LABELS: Record<string, string> = {
	"waiting-on-pu-date": "Waiting on PU Date",
	"at-pu": "At PU",
	"loaded-enroute": "Loaded & Enroute",
	"at-del": "At delivered",
	delivered: "delivered",
	tonu: "TONU",
	cancelled: "Cancelled",
	canceled: "Canceled",
	"waiting-on-rc": "Waiting on RC",
};

/** Same palette as mobile Your Loads cards. */
const LOAD_CHAT_STATUS_BG_CLASS: Record<string, string> = {
	"waiting-on-pu-date": "bg-[#F3F4F6] dark:bg-gray-800/80",
	"at-pu": "bg-[#E6F2FF] dark:bg-sky-950/55",
	"loaded-enroute": "bg-[#f7fef5] dark:bg-emerald-950/35",
	"at-del": "bg-[#effee9] dark:bg-emerald-950/45",
	delivered: "bg-[#effee9] dark:bg-emerald-950/45",
	"waiting-on-rc": "bg-[#FFF7D6] dark:bg-yellow-950/40",
	tonu: "bg-[#ffdcdc] dark:bg-red-950/45",
	cancelled: "bg-[#ffdcdc] dark:bg-red-950/45",
	canceled: "bg-[#ffdcdc] dark:bg-red-950/45",
};

export function normalizeLoadChatStatus(
	status: string | null | undefined
): string {
	return String(status ?? "")
		.trim()
		.toLowerCase()
		.replace(/_/g, "-");
}

export function formatLoadChatStatusLabel(
	status: string | null | undefined
): string | null {
	const raw = String(status ?? "").trim();
	if (!raw) return null;
	const normalized = normalizeLoadChatStatus(raw);
	return (
		LOAD_CHAT_STATUS_LABELS[normalized] ??
		raw.replace(/[_-]/g, " ").replace(/\b\w/g, char => char.toUpperCase())
	);
}

export function loadChatStatusBackgroundClass(
	status: string | null | undefined
): string | null {
	const normalized = normalizeLoadChatStatus(status);
	if (!normalized) return null;
	return LOAD_CHAT_STATUS_BG_CLASS[normalized] ?? null;
}
