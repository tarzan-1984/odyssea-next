import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
	DEFAULT_NOTIFICATION_SOUND,
	EXCLUDED_NOTIFICATION_SOUNDS,
	formatNotificationSoundLabel,
	notificationSoundUrl,
} from "@/constants/notificationSounds";

export async function GET() {
	try {
		const soundsDir = path.join(process.cwd(), "public", "sounds");
		const files = fs
			.readdirSync(soundsDir)
			.filter(
				file =>
					file.toLowerCase().endsWith(".mp3") && !EXCLUDED_NOTIFICATION_SOUNDS.has(file)
			)
			.sort((a, b) => {
				if (a === DEFAULT_NOTIFICATION_SOUND) return -1;
				if (b === DEFAULT_NOTIFICATION_SOUND) return 1;
				return a.localeCompare(b);
			});

		return NextResponse.json({
			sounds: files.map(file => ({
				file,
				url: notificationSoundUrl(file),
				label: formatNotificationSoundLabel(file),
			})),
		});
	} catch (error) {
		console.error("sounds GET:", error);
		return NextResponse.json({ error: "Failed to list notification sounds" }, { status: 500 });
	}
}
