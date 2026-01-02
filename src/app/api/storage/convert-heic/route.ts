import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/storage/convert-heic - Convert HEIC image to JPEG via backend
export async function GET(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		// Get image URL from query parameters
		const { searchParams } = new URL(request.url);
		const imageUrl = searchParams.get("url");

		if (!imageUrl) {
			return NextResponse.json(
				{ error: "Image URL is required" },
				{ status: 400 }
			);
		}

		// Make request to backend API for conversion
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/convert-heic?url=${encodeURIComponent(imageUrl)}`,
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
				{ error: errorData.error || "Failed to convert image" },
				{ status: response.status }
			);
		}

		// Get the JPEG image buffer
		const imageBuffer = await response.arrayBuffer();

		// Return the image with proper headers
		return new NextResponse(imageBuffer, {
			status: 200,
			headers: {
				"Content-Type": "image/jpeg",
				"Cache-Control": "public, max-age=31536000", // Cache for 1 year
			},
		});
	} catch (error) {
		console.error("Error converting HEIC image:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

