import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export const ADMIN_NOTIFICATION_SOUND_STORAGE_KEY = "odyssea-admin-notification-sound";

interface AdminNotificationSoundState {
	notificationSoundsMuted: boolean;
	setNotificationSoundsMuted: (muted: boolean) => void;
	toggleNotificationSoundsMuted: () => void;
}

function readMutedFlagFromLocalStorage(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	try {
		const raw = localStorage.getItem(ADMIN_NOTIFICATION_SOUND_STORAGE_KEY);
		if (!raw) {
			return false;
		}
		const parsed = JSON.parse(raw) as { state?: { notificationSoundsMuted?: boolean } };
		return parsed?.state?.notificationSoundsMuted === true;
	} catch {
		return false;
	}
}

/**
 * Use before playing UI notification sounds. Handles zustand-persist async rehydration:
 * until `hasHydrated()` is true, in-memory state stays at default (unmuted) while
 * localStorage may already contain muted=true.
 */
export function isNotificationSoundMuted(): boolean {
	const storeMuted = useAdminNotificationSoundStore.getState().notificationSoundsMuted;
	if (storeMuted) {
		return true;
	}
	if (typeof window === "undefined") {
		return false;
	}
	if (useAdminNotificationSoundStore.persist.hasHydrated()) {
		return false;
	}
	return readMutedFlagFromLocalStorage();
}

export const useAdminNotificationSoundStore = create<AdminNotificationSoundState>()(
	devtools(
		persist(
			set => ({
				notificationSoundsMuted: false,
				setNotificationSoundsMuted: muted =>
					set({ notificationSoundsMuted: muted }, false, "setNotificationSoundsMuted"),
				toggleNotificationSoundsMuted: () =>
					set(
						s => ({ notificationSoundsMuted: !s.notificationSoundsMuted }),
						false,
						"toggleNotificationSoundsMuted"
					),
			}),
			{
				name: ADMIN_NOTIFICATION_SOUND_STORAGE_KEY,
				partialize: state => ({ notificationSoundsMuted: state.notificationSoundsMuted }),
			}
		),
		{ name: "admin-notification-sound-store" }
	)
);
