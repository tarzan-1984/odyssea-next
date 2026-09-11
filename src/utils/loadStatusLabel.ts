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

/** Same palette as mobile Your Loads cards; dark mode uses richer (more saturated) tints. */
const LOAD_CHAT_STATUS_BG_CLASS: Record<string, string> = {
	"waiting-on-pu-date": "bg-[#F3F4F6] dark:bg-[#C5CDD8]",
	"at-pu": "bg-[#E6F2FF] dark:bg-[#9EC5F7]",
	"loaded-enroute": "bg-[#f7fef5] dark:bg-[#B8F0A8]",
	"at-del": "bg-[#effee9] dark:bg-[#A8E890]",
	delivered: "bg-[#effee9] dark:bg-[#A8E890]",
	"waiting-on-rc": "bg-[#FFF7D6] dark:bg-[#F5D96A]",
	tonu: "bg-[#ffdcdc] dark:bg-[#F5A0A0]",
	cancelled: "bg-[#ffdcdc] dark:bg-[#F5A0A0]",
	canceled: "bg-[#ffdcdc] dark:bg-[#F5A0A0]",
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
