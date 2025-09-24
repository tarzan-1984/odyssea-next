import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/utils";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { email } = body;

		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		// Validate email format
		if (!isValidEmail(email)) {
			return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
		}

		// Send request to backend for forgot password
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/forgot-password`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
				}),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to process forgot password request" },
				{ status: response.status }
			);
		}

		// Backend always returns 200 with message, so we return the data as is
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during forgot password request:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
