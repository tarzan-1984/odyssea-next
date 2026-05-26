import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { DEFAULT_NOTIFICATION_SOUND } from "@/constants/notificationSounds";

export const ADMIN_NOTIFICATION_SOUND_STORAGE_KEY = "odyssea-admin-notification-sound";

interface AdminNotificationSoundState {
	notificationSoundsMuted: boolean;
	selectedNotificationSound: string;
	setNotificationSoundsMuted: (muted: boolean) => void;
	toggleNotificationSoundsMuted: () => void;
	setSelectedNotificationSound: (file: string) => void;
}

type PersistedNotificationSoundState = {
	notificationSoundsMuted?: boolean;
	selectedNotificationSound?: string;
};

function readPersistedStateFromLocalStorage(): PersistedNotificationSoundState | null {
	if (typeof window === "undefined") {
		return null;
	}
	try {
		const raw = localStorage.getItem(ADMIN_NOTIFICATION_SOUND_STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as { state?: PersistedNotificationSoundState };
		return parsed?.state ?? null;
	} catch {
		return null;
	}
}

function readMutedFlagFromLocalStorage(): boolean {
	return readPersistedStateFromLocalStorage()?.notificationSoundsMuted === true;
}

function readSelectedSoundFromLocalStorage(): string | null {
	const file = readPersistedStateFromLocalStorage()?.selectedNotificationSound;
	return typeof file === "string" && file.length > 0 ? file : null;
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

/**
 * Selected notification mp3 filename (e.g. livechat.mp3). Handles persist rehydration race.
 */
export function getSelectedNotificationSoundFile(): string {
	if (typeof window === "undefined") {
		return DEFAULT_NOTIFICATION_SOUND;
	}
	const fromStore = useAdminNotificationSoundStore.getState().selectedNotificationSound;
	if (useAdminNotificationSoundStore.persist.hasHydrated()) {
		return fromStore || DEFAULT_NOTIFICATION_SOUND;
	}
	return readSelectedSoundFromLocalStorage() ?? fromStore ?? DEFAULT_NOTIFICATION_SOUND;
}

export const useAdminNotificationSoundStore = create<AdminNotificationSoundState>()(
	devtools(
		persist(
			set => ({
				notificationSoundsMuted: false,
				selectedNotificationSound: DEFAULT_NOTIFICATION_SOUND,
				setNotificationSoundsMuted: muted =>
					set({ notificationSoundsMuted: muted }, false, "setNotificationSoundsMuted"),
				toggleNotificationSoundsMuted: () =>
					set(
						s => ({ notificationSoundsMuted: !s.notificationSoundsMuted }),
						false,
						"toggleNotificationSoundsMuted"
					),
				setSelectedNotificationSound: file =>
					set({ selectedNotificationSound: file }, false, "setSelectedNotificationSound"),
			}),
			{
				name: ADMIN_NOTIFICATION_SOUND_STORAGE_KEY,
				partialize: state => ({
					notificationSoundsMuted: state.notificationSoundsMuted,
					selectedNotificationSound: state.selectedNotificationSound,
				}),
			}
		),
		{ name: "admin-notification-sound-store" }
	)
);
