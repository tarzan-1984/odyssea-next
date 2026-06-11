import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/storage/ensure-thumbnail - Create missing chat thumbnail in Wasabi (JSON only, no image proxy)
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const imageUrl = searchParams.get("url");
		const fileName = searchParams.get("fileName");
		if (!imageUrl) {
			return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
		}
		if (!fileName?.trim()) {
			return NextResponse.json({ error: "fileName is required" }, { status: 400 });
		}

		const backendParams = new URLSearchParams({
			url: imageUrl,
			fileName: fileName.trim(),
		});
		const width = searchParams.get("w");
		const quality = searchParams.get("q");
		if (width) backendParams.set("w", width);
		if (quality) backendParams.set("q", quality);

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/ensure-thumbnail?${backendParams.toString()}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			}
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || data.message || "Failed to ensure thumbnail" },
				{ status: response.status }
			);
		}

		const payload = data.data ?? data;
		return NextResponse.json(payload, { status: 200 });
	} catch (error) {
		console.error("Error ensuring chat thumbnail:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
