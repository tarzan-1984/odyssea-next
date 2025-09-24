import { NextRequest, NextResponse } from "next/server";
import { tokenEncoder } from "@/utils/tokenEncoder";
import { isValidEmail } from "@/utils";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { email, otp } = body;

		if (!email || !otp) {
			return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
		}

		// Validate email format
		if (!isValidEmail(email)) {
			return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
		}

		// Send request to backend for OTP verification
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/verify-otp`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email,
				otp,
			}),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to verify OTP" },
				{ status: response.status }
			);
		}

		// Encode tokens before returning them
		if (data.data?.accessToken) {
			data.data.accessToken = tokenEncoder.encode(data.data.accessToken);
		}

		if (data.data?.refreshToken) {
			data.data.refreshToken = tokenEncoder.encode(data.data.refreshToken);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during OTP verification:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
