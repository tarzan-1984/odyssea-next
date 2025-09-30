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

		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/login_email`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to verify email" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during email verification:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
