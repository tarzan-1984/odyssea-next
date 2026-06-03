import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

function safeFilename(name: string): string {
	const base = (name || "download").trim();
	// Keep it simple: strip path separators and control chars.
	return base.replace(/[\\/\r\n\t]/g, "-").slice(0, 160) || "download";
}

function isHeicAttachment(name: string, url: string): boolean {
	return /\.(heic|heif)$/i.test(name) || /\.(heic|heif)(?:\?|$)/i.test(url);
}

function toJpegFilename(name: string): string {
	if (/\.(heic|heif)$/i.test(name)) {
		return name.replace(/\.(heic|heif)$/i, ".jpg");
	}
	return `${name.replace(/\.[^/.]+$/, "") || "image"}.jpg`;
}

async function tryDownloadHeicAsJpeg(
	url: string,
	downloadName: string,
	request: NextRequest
): Promise<NextResponse | null> {
	const accessToken = serverAuth.getAccessToken(request);
	if (!accessToken) {
		return null;
	}

	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/convert-heic?url=${encodeURIComponent(url)}`,
			{
				method: "GET",
				headers: { Authorization: `Bearer ${accessToken}` },
				cache: "no-store",
			}
		);

		if (!response.ok) {
			return null;
		}

		const buf = await response.arrayBuffer();
		if (!buf.byteLength) {
			return null;
		}

		const jpegName = toJpegFilename(downloadName);
		return new NextResponse(buf, {
			status: 200,
			headers: {
				"Content-Type": "image/jpeg",
				"Content-Disposition": `attachment; filename="${jpegName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch {
		return null;
	}
}

export async function GET(request: NextRequest) {
	try {
		const url = request.nextUrl.searchParams.get("url")?.trim();
		const name = safeFilename(request.nextUrl.searchParams.get("name") || "download");
		if (!url) {
			return NextResponse.json({ error: "Missing url" }, { status: 400 });
		}
		// Basic safety: only allow http(s)
		if (!/^https?:\/\//i.test(url)) {
			return NextResponse.json({ error: "Invalid url" }, { status: 400 });
		}

		if (isHeicAttachment(name, url)) {
			const converted = await tryDownloadHeicAsJpeg(url, name, request);
			if (converted) {
				return converted;
			}
			// Conversion failed — still return the original file so nothing is lost
		}

		const upstream = await fetch(url, { cache: "no-store" });
		if (!upstream.ok) {
			return NextResponse.json({ error: "Failed to download file" }, { status: 502 });
		}

		const contentType =
			upstream.headers.get("Content-Type") || "application/octet-stream";
		const buf = await upstream.arrayBuffer();

		return new NextResponse(buf, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Disposition": `attachment; filename="${name}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error("[api/storage/download]", error);
		return NextResponse.json({ error: "Download failed" }, { status: 500 });
	}
}

