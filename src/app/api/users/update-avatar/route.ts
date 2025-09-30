import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function PUT(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		// Get user data to extract userId
		const userData = serverAuth.getUserData(request);
		if (!userData) {
			return NextResponse.json({ error: "User data not found" }, { status: 401 });
		}

		const body = await request.json();
		const { avatarUrl } = body;

		if (!avatarUrl) {
			return NextResponse.json({ error: "Avatar URL is required" }, { status: 400 });
		}

		// Send request to backend to update user avatar
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/${userData.id}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					profilePhoto: avatarUrl, // Backend expects profilePhoto field
				}),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to update avatar" },
				{ status: response.status }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Avatar updated successfully",
			user: data,
		});
	} catch (error) {
		console.error("Error updating avatar:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
