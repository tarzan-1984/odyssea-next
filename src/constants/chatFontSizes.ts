/** Default chat message typography (px) — matches current Tailwind text-sm / text-theme-xs. */
export const CHAT_FONT_BASE_PX = {
	body: 14,
	bodyLineHeight: 20,
	name: 14,
	nameLineHeight: 20,
	meta: 12,
	metaLineHeight: 18,
	replyContent: 13,
	replyLabel: 11,
	replyTime: 10,
} as const;

export type ChatFontScaleKey = "body" | "name" | "meta";

export type ChatFontScales = Record<ChatFontScaleKey, number>;

export const CHAT_FONT_SCALE_DEFAULT = 1;
export const CHAT_FONT_SCALE_MIN = 0.75;
export const CHAT_FONT_SCALE_MAX = 1.25;

export const CHAT_FONT_SCALE_DEFAULTS: ChatFontScales = {
	body: CHAT_FONT_SCALE_DEFAULT,
	name: CHAT_FONT_SCALE_DEFAULT,
	meta: CHAT_FONT_SCALE_DEFAULT,
};

export function clampChatFontScale(value: unknown): number {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(n)) {
		return CHAT_FONT_SCALE_DEFAULT;
	}
	return Math.min(CHAT_FONT_SCALE_MAX, Math.max(CHAT_FONT_SCALE_MIN, n));
}

export function normalizeChatFontScales(
	input: Partial<ChatFontScales> | null | undefined
): ChatFontScales {
	return {
		body: clampChatFontScale(input?.body ?? CHAT_FONT_SCALE_DEFAULT),
		name: clampChatFontScale(input?.name ?? CHAT_FONT_SCALE_DEFAULT),
		meta: clampChatFontScale(input?.meta ?? CHAT_FONT_SCALE_DEFAULT),
	};
}

function scalePx(base: number, scale: number): string {
	return `${Math.round(base * scale * 10) / 10}px`;
}

/** Reply quote typography follows message body / meta scales. */
export function buildChatFontCssVariables(scales: ChatFontScales): Record<string, string> {
	const s = normalizeChatFontScales(scales);
	return {
		"--chat-font-body": scalePx(CHAT_FONT_BASE_PX.body, s.body),
		"--chat-font-body-lh": scalePx(CHAT_FONT_BASE_PX.bodyLineHeight, s.body),
		"--chat-font-name": scalePx(CHAT_FONT_BASE_PX.name, s.name),
		"--chat-font-name-lh": scalePx(CHAT_FONT_BASE_PX.nameLineHeight, s.name),
		"--chat-font-meta": scalePx(CHAT_FONT_BASE_PX.meta, s.meta),
		"--chat-font-meta-lh": scalePx(CHAT_FONT_BASE_PX.metaLineHeight, s.meta),
		"--chat-font-reply-content": scalePx(CHAT_FONT_BASE_PX.replyContent, s.body),
		"--chat-font-reply-label": scalePx(CHAT_FONT_BASE_PX.replyLabel, s.meta),
		"--chat-font-reply-time": scalePx(CHAT_FONT_BASE_PX.replyTime, s.meta),
	};
}

export function chatFontScaleToPercent(scale: number): number {
	return Math.round(clampChatFontScale(scale) * 100);
}

export function percentToChatFontScale(percent: number): number {
	return clampChatFontScale(percent / 100);
}

export function scaledChatFontPx(basePx: number, scale: number): number {
	return Math.round(basePx * clampChatFontScale(scale) * 10) / 10;
}

export function isDefaultChatFontScales(scales: ChatFontScales): boolean {
	return (
		scales.body === CHAT_FONT_SCALE_DEFAULT &&
		scales.name === CHAT_FONT_SCALE_DEFAULT &&
		scales.meta === CHAT_FONT_SCALE_DEFAULT
	);
}
