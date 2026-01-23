import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		const userId = userData?.id;
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { newPassword } = body as { newPassword?: string };

		if (!newPassword) {
			return NextResponse.json({ error: "New password is required" }, { status: 400 });
		}

		if (newPassword.length < 8) {
			return NextResponse.json(
				{ error: "Password must be at least 8 characters long" },
				{ status: 400 }
			);
		}

		if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
			return NextResponse.json(
				{ error: "Password must contain uppercase letters and numbers" },
				{ status: 400 }
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/${userId}/password`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ newPassword }),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to change password" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during password change:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

