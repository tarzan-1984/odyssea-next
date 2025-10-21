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
		const backendResponse = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/verify-otp`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email,
					otp,
				}),
			}
		);

		const data = await backendResponse.json();

		if (!backendResponse.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to verify OTP" },
				{ status: backendResponse.status }
			);
		}

		// Encode tokens before returning them
		if (data.data?.accessToken) {
			data.data.accessToken = tokenEncoder.encode(data.data.accessToken);
		}

		if (data.data?.refreshToken) {
			data.data.refreshToken = tokenEncoder.encode(data.data.refreshToken);
		}

		// Create response with cookies
		const response = NextResponse.json(data, { status: 200 });

		// Set cookies for tokens
		if (data.data?.accessToken) {
			response.cookies.set("accessToken", data.data.accessToken, {
				httpOnly: false, // Allow client-side access for js-cookie
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 60 * 60 * 24 * 7, // 7 days
				path: "/",
			});
		}

		if (data.data?.refreshToken) {
			response.cookies.set("refreshToken", data.data.refreshToken, {
				httpOnly: false, // Allow client-side access for js-cookie
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				maxAge: 60 * 60 * 24 * 30, // 30 days
				path: "/",
			});
		}

		// Clear login-success cookie as it's no longer needed
		response.cookies.delete("login-success");

		return response;
	} catch (error) {
		console.error("Error during OTP verification:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
