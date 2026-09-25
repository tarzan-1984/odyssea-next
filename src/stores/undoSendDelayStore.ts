import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
	UNDO_SEND_DELAY_DEFAULT_SECONDS,
	clampUndoSendDelaySeconds,
} from "@/constants/undoSendDelay";

export const UNDO_SEND_DELAY_STORAGE_KEY = "odyssea-undo-send-delay";

interface UndoSendDelayState {
	delaySeconds: number;
	setDelaySeconds: (seconds: number) => void;
}

export function getUndoSendDelaySeconds(): number {
	if (typeof window === "undefined") {
		return UNDO_SEND_DELAY_DEFAULT_SECONDS;
	}
	const fromStore = useUndoSendDelayStore.getState().delaySeconds;
	if (useUndoSendDelayStore.persist.hasHydrated()) {
		return clampUndoSendDelaySeconds(fromStore);
	}
	try {
		const raw = localStorage.getItem(UNDO_SEND_DELAY_STORAGE_KEY);
		if (!raw) return clampUndoSendDelaySeconds(fromStore);
		const parsed = JSON.parse(raw) as { state?: { delaySeconds?: number } };
		return clampUndoSendDelaySeconds(parsed?.state?.delaySeconds ?? fromStore);
	} catch {
		return clampUndoSendDelaySeconds(fromStore);
	}
}

export const useUndoSendDelayStore = create<UndoSendDelayState>()(
	devtools(
		persist(
			set => ({
				delaySeconds: UNDO_SEND_DELAY_DEFAULT_SECONDS,
				setDelaySeconds: seconds =>
					set(
						{ delaySeconds: clampUndoSendDelaySeconds(seconds) },
						false,
						"setUndoSendDelaySeconds"
					),
			}),
			{
				name: UNDO_SEND_DELAY_STORAGE_KEY,
				partialize: state => ({ delaySeconds: state.delaySeconds }),
				onRehydrateStorage: () => state => {
					if (state) {
						state.delaySeconds = clampUndoSendDelaySeconds(state.delaySeconds);
					}
				},
			}
		),
		{ name: "undo-send-delay-store" }
	)
);
