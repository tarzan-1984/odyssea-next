import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import {
	DEFAULT_TOAST_POSITION,
	isToastPosition,
	type ToastPosition,
} from "@/constants/toastNotifications";

export const TOAST_POSITION_STORAGE_KEY = "odyssea-toast-position";

interface ToastPositionState {
	position: ToastPosition;
	setPosition: (position: ToastPosition) => void;
	resetPosition: () => void;
}

function readPersistedPositionFromLocalStorage(): ToastPosition | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = localStorage.getItem(TOAST_POSITION_STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as { state?: { position?: unknown } };
		const position = parsed?.state?.position;
		return isToastPosition(position) ? position : null;
	} catch {
		return null;
	}
}

export function getToastPosition(): ToastPosition {
	if (typeof window === "undefined") {
		return DEFAULT_TOAST_POSITION;
	}
	const fromStore = useToastPositionStore.getState().position;
	if (useToastPositionStore.persist.hasHydrated()) {
		return isToastPosition(fromStore) ? fromStore : DEFAULT_TOAST_POSITION;
	}
	return readPersistedPositionFromLocalStorage() ?? DEFAULT_TOAST_POSITION;
}

export const useToastPositionStore = create<ToastPositionState>()(
	devtools(
		persist(
			set => ({
				position: DEFAULT_TOAST_POSITION,
				setPosition: position =>
					set(
						{ position: isToastPosition(position) ? position : DEFAULT_TOAST_POSITION },
						false,
						"setToastPosition"
					),
				resetPosition: () =>
					set({ position: DEFAULT_TOAST_POSITION }, false, "resetToastPosition"),
			}),
			{
				name: TOAST_POSITION_STORAGE_KEY,
				partialize: state => ({ position: state.position }),
				onRehydrateStorage: () => state => {
					if (state && !isToastPosition(state.position)) {
						state.position = DEFAULT_TOAST_POSITION;
					}
				},
			}
		),
		{ name: "toast-position-store" }
	)
);
