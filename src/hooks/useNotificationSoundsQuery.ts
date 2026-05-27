import { useQuery } from "@tanstack/react-query";
import {
	EXCLUDED_NOTIFICATION_SOUNDS,
	FALLBACK_NOTIFICATION_SOUNDS,
	formatNotificationSoundLabel,
	notificationSoundUrl,
} from "@/constants/notificationSounds";

export type NotificationSoundOption = {
	id?: string;
	file: string;
	url: string;
	label: string;
	isUserOwned?: boolean;
	fileSize?: number;
};

export const notificationSoundsQueryKey = ["notification-sounds"] as const;

function buildFallbackSounds(): NotificationSoundOption[] {
	return FALLBACK_NOTIFICATION_SOUNDS.filter(f => !EXCLUDED_NOTIFICATION_SOUNDS.has(f)).map(
		file => ({
			file,
			url: notificationSoundUrl(file),
			label: formatNotificationSoundLabel(file),
		})
	);
}

async function fetchNotificationSounds(): Promise<NotificationSoundOption[]> {
	try {
		const res = await fetch("/api/sounds");
		if (!res.ok) {
			throw new Error("Failed to load sounds");
		}
		const data = (await res.json()) as { sounds?: NotificationSoundOption[] };
		if (Array.isArray(data.sounds) && data.sounds.length > 0) {
			return data.sounds;
		}
		throw new Error("Empty sounds list");
	} catch {
		return buildFallbackSounds();
	}
}

/** Static list of bundled notification sounds — cached for the session lifetime. */
export function useNotificationSoundsQuery() {
	return useQuery({
		queryKey: notificationSoundsQueryKey,
		queryFn: fetchNotificationSounds,
		staleTime: Number.POSITIVE_INFINITY,
		gcTime: Number.POSITIVE_INFINITY,
	});
}
