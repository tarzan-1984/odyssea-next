import { NextRequest, NextResponse } from "next/server";

// GET /api/users/external/[externalId]/public - Get user by external ID (Public, no auth required)
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ externalId: string }> }
) {
	try {
		const { externalId } = await params;

		if (!externalId) {
			return NextResponse.json(
				{ error: "External ID is required" },
				{ status: 400 }
			);
		}

		// Make request to backend API (public endpoint, no auth required)
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/external/${externalId}/public`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			console.error("Backend API error:", data);
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to get user" },
				{ status: response.status }
			);
		}

		console.log("Backend API response:", data);
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error getting user by external ID:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

