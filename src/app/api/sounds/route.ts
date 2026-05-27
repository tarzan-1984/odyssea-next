import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
	DEFAULT_NOTIFICATION_SOUND,
	EXCLUDED_NOTIFICATION_SOUNDS,
	formatNotificationSoundLabel,
	notificationSoundUrl,
} from "@/constants/notificationSounds";
import { serverAuth } from "@/utils/auth";

function isAllowedSoundFilename(name: string): boolean {
	const lower = name.toLowerCase();
	return lower.endsWith(".mp3") || lower.endsWith(".wav");
}

export async function GET(request: NextRequest) {
	try {
		const soundsDir = path.join(process.cwd(), "public", "sounds");
		const bundled = (fs.existsSync(soundsDir) ? fs.readdirSync(soundsDir) : [])
			.filter(
				file =>
					isAllowedSoundFilename(file) &&
					!EXCLUDED_NOTIFICATION_SOUNDS.has(file) &&
					!file.includes("/") &&
					!file.includes("\\")
			)
			.sort((a, b) => {
				if (a === DEFAULT_NOTIFICATION_SOUND) return -1;
				if (b === DEFAULT_NOTIFICATION_SOUND) return 1;
				return a.localeCompare(b);
			});

		const accessToken = serverAuth.getAccessToken(request);
		const userData = serverAuth.getUserData(request);
		const userId = userData?.id?.trim() || null;

		let custom: Array<{ id: string; fileUrl: string; fileName: string; fileSize?: number }> = [];
		const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
		if (accessToken && backendBase) {
			const res = await fetch(`${backendBase}/v1/notification-sounds`, {
				headers: { Authorization: `Bearer ${accessToken}` },
				cache: "no-store",
			}).catch(() => null);
			if (res && res.ok) {
				const payload = (await res.json().catch(() => null)) as any;
				// Nest often wraps: { data: <actual>, ... } and sometimes { data: { data: <actual> }, ... }
				const data = payload?.data?.data ?? payload?.data ?? payload;
				if (Array.isArray(data)) {
					custom = data;
				}
			}
		}

		return NextResponse.json({
			userId,
			sounds: [
				...bundled.map(file => ({
					file,
					url: notificationSoundUrl(file),
					label: formatNotificationSoundLabel(file),
					isUserOwned: false,
				})),
				...custom.map(row => ({
					id: row.id,
					// Store absolute URL as "file" so the selection plays the correct audio.
					file: row.fileUrl,
					url: row.fileUrl,
					label: formatNotificationSoundLabel(row.fileName),
					isUserOwned: true,
					fileSize: row.fileSize,
				})),
			],
		});
	} catch (error) {
		console.error("sounds GET:", error);
		return NextResponse.json({ error: "Failed to list notification sounds" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = (await request.json().catch(() => null)) as
			| { fileUrl?: string; key?: string; fileName?: string; fileSize?: number }
			| null;
		if (!body?.fileUrl || !body?.key || !body?.fileName) {
			return NextResponse.json({ error: "Missing payload" }, { status: 400 });
		}
		if (!isAllowedSoundFilename(body.fileName)) {
			return NextResponse.json(
				{ error: "Only .mp3 or .wav files are allowed" },
				{ status: 400 }
			);
		}

		const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
		if (!backendBase) {
			return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 });
		}

		const res = await fetch(`${backendBase}/v1/notification-sounds`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});
		const text = await res.text();
		return new NextResponse(text, {
			status: res.status,
			headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
		});
	} catch (error) {
		console.error("sounds POST:", error);
		return NextResponse.json({ error: "Failed to upload sound" }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const id = request.nextUrl.searchParams.get("id")?.trim();
		if (!id) {
			return NextResponse.json({ error: "Missing id param" }, { status: 400 });
		}

		const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
		if (!backendBase) {
			return NextResponse.json({ error: "Backend URL not configured" }, { status: 500 });
		}

		const res = await fetch(`${backendBase}/v1/notification-sounds/${encodeURIComponent(id)}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		const text = await res.text();
		return new NextResponse(text, {
			status: res.status,
			headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
		});
	} catch (error) {
		console.error("sounds DELETE:", error);
		return NextResponse.json({ error: "Failed to delete sound" }, { status: 500 });
	}
}
