import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
	CHAT_FONT_SCALE_DEFAULTS,
	type ChatFontScaleKey,
	type ChatFontScales,
	clampChatFontScale,
	normalizeChatFontScales,
} from "@/constants/chatFontSizes";

export const CHAT_FONT_SIZE_STORAGE_KEY = "odyssea-chat-font-size";

/** @deprecated legacy single scale — migrated to `scales` on rehydrate */
type LegacyPersistedChatFontSizeState = {
	scale?: number;
	scales?: Partial<ChatFontScales>;
};

interface ChatFontSizeState {
	scales: ChatFontScales;
	setScale: (key: ChatFontScaleKey, scale: number) => void;
	resetScales: () => void;
}

function readPersistedScalesFromLocalStorage(): ChatFontScales | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = localStorage.getItem(CHAT_FONT_SIZE_STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as { state?: LegacyPersistedChatFontSizeState };
		const state = parsed?.state;
		if (!state) {
			return null;
		}
		if (state.scales) {
			return normalizeChatFontScales(state.scales);
		}
		if (typeof state.scale === "number") {
			const legacy = clampChatFontScale(state.scale);
			return { body: legacy, name: legacy, meta: legacy };
		}
		return null;
	} catch {
		return null;
	}
}

export function getChatFontScales(): ChatFontScales {
	if (typeof window === "undefined") {
		return CHAT_FONT_SCALE_DEFAULTS;
	}
	const fromStore = useChatFontSizeStore.getState().scales;
	if (useChatFontSizeStore.persist.hasHydrated()) {
		return normalizeChatFontScales(fromStore);
	}
	return readPersistedScalesFromLocalStorage() ?? normalizeChatFontScales(fromStore);
}

export const useChatFontSizeStore = create<ChatFontSizeState>()(
	devtools(
		persist(
			set => ({
				scales: CHAT_FONT_SCALE_DEFAULTS,
				setScale: (key, scale) =>
					set(
						state => ({
							scales: {
								...state.scales,
								[key]: clampChatFontScale(scale),
							},
						}),
						false,
						"setChatFontScale"
					),
				resetScales: () =>
					set({ scales: CHAT_FONT_SCALE_DEFAULTS }, false, "resetChatFontScales"),
			}),
			{
				name: CHAT_FONT_SIZE_STORAGE_KEY,
				version: 2,
				migrate: (persisted: unknown) => {
					const p = persisted as LegacyPersistedChatFontSizeState | undefined;
					if (p?.scales) {
						return { scales: normalizeChatFontScales(p.scales) };
					}
					const legacy = clampChatFontScale(p?.scale ?? 1);
					return {
						scales: { body: legacy, name: legacy, meta: legacy },
					};
				},
				partialize: state => ({ scales: state.scales }),
				onRehydrateStorage: () => state => {
					if (state) {
						state.scales = normalizeChatFontScales(state.scales);
					}
				},
			}
		),
		{ name: "chat-font-size-store" }
	)
);
