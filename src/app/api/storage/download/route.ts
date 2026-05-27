import { NextRequest, NextResponse } from "next/server";

function safeFilename(name: string): string {
	const base = (name || "download").trim();
	// Keep it simple: strip path separators and control chars.
	return base.replace(/[\\/\r\n\t]/g, "-").slice(0, 160) || "download";
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

