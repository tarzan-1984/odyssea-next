import { NextRequest, NextResponse } from "next/server";
import { storeVideoPosterOnly } from "@/server/storage/videoPoster";
import { serverAuth } from "@/utils/auth";

const VIDEO_EXTENSIONS = new Set(["mp4", "m4v", "mov", "webm", "3gp", "3gpp"]);

/**
 * mode=poster   — fast JPEG frame in Next (seconds)
 * mode=playable — start / check H.264 on Nest (non-blocking; client polls until ready)
 */
export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const fileUrl = typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
		const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "video.mp4";
		const mode = body?.mode === "playable" ? "playable" : "poster";
		const extension = fileName.toLowerCase().split(".").pop() || "";
		if (!fileUrl || !VIDEO_EXTENSIONS.has(extension)) {
			return NextResponse.json({ error: "Video file is required" }, { status: 400 });
		}

		if (mode === "poster") {
			const poster = await storeVideoPosterOnly(fileUrl);
			return NextResponse.json(poster);
		}

		const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
		if (!backendUrl) {
			return NextResponse.json(
				{ error: "Backend URL is not configured" },
				{ status: 500 },
			);
		}

		// wait=false: Nest returns quickly with status ready|processing (no Render timeout on encode).
		const params = new URLSearchParams({
			url: fileUrl,
			fileName,
			wait: "false",
		});
		const response = await fetch(
			`${backendUrl}/v1/storage/ensure-video-playable?${params.toString()}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to prepare playable video" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data?.data ?? data);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to prepare video";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
