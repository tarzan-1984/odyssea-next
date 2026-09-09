const LOAD_CHAT_STATUS_LABELS: Record<string, string> = {
	"waiting-on-pu-date": "Waiting on PU Date",
	"at-pu": "At PU",
	"loaded-enroute": "Loaded & Enroute",
	"at-del": "At delivery",
	delivered: "delivered",
	tonu: "TONU",
	cancelled: "Cancelled",
	canceled: "Canceled",
	"waiting-on-rc": "Waiting on RC",
};

/** Same palette as mobile Your Loads cards. */
const LOAD_CHAT_STATUS_BG_CLASS: Record<string, string> = {
	"waiting-on-pu-date": "bg-[#F3F4F6] dark:bg-[#F3F4F6]",
	"at-pu": "bg-[#E6F2FF] dark:bg-[#E6F2FF]",
	"loaded-enroute": "bg-[#f7fef5] dark:bg-[#f7fef5]",
	"at-del": "bg-[#effee9] dark:bg-[#effee9]",
	delivered: "bg-[#effee9] dark:bg-[#effee9]",
	"waiting-on-rc": "bg-[#FFF7D6] dark:bg-[#FFF7D6]",
	tonu: "bg-[#ffdcdc] dark:bg-[#ffdcdc]",
	cancelled: "bg-[#ffdcdc] dark:bg-[#ffdcdc]",
	canceled: "bg-[#ffdcdc] dark:bg-[#ffdcdc]",
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
