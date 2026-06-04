"use client";

import { useEffect } from "react";
import { buildChatFontCssVariables } from "@/constants/chatFontSizes";
import { useChatFontSizeStore } from "@/stores/chatFontSizeStore";

/** Applies chat font CSS variables to :root when scales change or store rehydrates. */
export default function ChatFontSizeCssSync() {
	const scales = useChatFontSizeStore(s => s.scales);

	useEffect(() => {
		const apply = () => {
			const vars = buildChatFontCssVariables(useChatFontSizeStore.getState().scales);
			const root = document.documentElement;
			for (const [key, value] of Object.entries(vars)) {
				root.style.setProperty(key, value);
			}
		};

		apply();

		const unsub = useChatFontSizeStore.persist.onFinishHydration(apply);

		return unsub;
	}, [scales.body, scales.name, scales.meta]);

	return null;
}
