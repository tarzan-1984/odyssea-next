import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/storage/image-preview - Resize image for chat thumbnails via backend
export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const imageUrl = searchParams.get("url");
		if (!imageUrl) {
			return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
		}

		const backendParams = new URLSearchParams({ url: imageUrl });
		const width = searchParams.get("w");
		const quality = searchParams.get("q");
		if (width) backendParams.set("w", width);
		if (quality) backendParams.set("q", quality);

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/image-preview?${backendParams.toString()}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			return NextResponse.json(
				{ error: errorData.error || errorData.message || "Failed to create image preview" },
				{ status: response.status }
			);
		}

		const imageBuffer = await response.arrayBuffer();
		return new NextResponse(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": "image/jpeg",
				"Cache-Control": "public, max-age=31536000, immutable",
			},
		});
	} catch (error) {
		console.error("Error creating image preview:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
