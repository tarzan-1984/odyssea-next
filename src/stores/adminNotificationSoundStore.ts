import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface AdminNotificationSoundState {
	notificationSoundsMuted: boolean;
	setNotificationSoundsMuted: (muted: boolean) => void;
	toggleNotificationSoundsMuted: () => void;
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
				name: "odyssea-admin-notification-sound",
				partialize: state => ({ notificationSoundsMuted: state.notificationSoundsMuted }),
			}
		),
		{ name: "admin-notification-sound-store" }
	)
);
