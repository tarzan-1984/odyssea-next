export const DEFAULT_NOTIFICATION_SOUND = "livechat.mp3";

/** Not selectable in profile (e.g. stop cue). */
export const EXCLUDED_NOTIFICATION_SOUNDS = new Set(["stop.mp3"]);

export function formatNotificationSoundLabel(file: string): string {
	if (file === DEFAULT_NOTIFICATION_SOUND) {
		return "Live chat (default)";
	}
	const base = file.replace(/\.mp3$/i, "");
	return base
		.replace(/[-_]/g, " ")
		.replace(/\b\w/g, c => c.toUpperCase())
		.slice(0, 80);
}

export function notificationSoundUrl(file: string): string {
	return `/sounds/${file}`;
}

/** Fallback when /api/sounds is unavailable. */
export const FALLBACK_NOTIFICATION_SOUNDS: string[] = [
	"livechat.mp3",
	"Monetka.mp3",
	"benkirb-notification-sound-3-262896.mp3",
	"lesiakower-modern-notification-sound-effect-481507.mp3",
	"notification_message-best-notification-1-286672.mp3",
	"notification_message-notify-10-313757.mp3",
	"soundshelfstudio-ui-notification-for-pc-526570.mp3",
];
