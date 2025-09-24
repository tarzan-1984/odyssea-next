import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { token, newPassword } = body;

		if (!token || !newPassword) {
			return NextResponse.json(
				{ error: "Token and new password are required" },
				{ status: 400 }
			);
		}

		if (newPassword.length < 6) {
			return NextResponse.json(
				{ error: "Password must be at least 6 characters long" },
				{ status: 400 }
			);
		}

		// Send request to backend for password reset
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/reset-password`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					token,
					newPassword,
				}),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to reset password" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during password reset:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
