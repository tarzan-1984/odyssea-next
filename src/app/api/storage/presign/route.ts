import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// POST /api/storage/presign - Get presigned URL for file upload
export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const { filename, contentType } = body;

		// Validate required fields
		if (!filename || !contentType) {
			return NextResponse.json(
				{ error: "Missing required fields: filename, contentType" },
				{ status: 400 }
			);
		}

		// Make request to backend API
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/presign`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({ filename, contentType }),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to get presigned URL" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting presigned URL:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
