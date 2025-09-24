import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/utils";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();

		// Validate required fields
		const { email, password, firstName, lastName, role } = body;

		if (!email || !password || !firstName || !lastName || !role) {
			return NextResponse.json(
				{ error: "Missing required fields: email, password, firstName, lastName, role" },
				{ status: 400 }
			);
		}

		// Validate email format
		if (!isValidEmail(email)) {
			return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
		}

		// Validate password length
		if (password.length < 6) {
			return NextResponse.json(
				{ error: "Password must be at least 6 characters long" },
				{ status: 400 }
			);
		}

		// Check if user has admin role
		if (role !== "ADMINISTRATOR") {
			return NextResponse.json(
				{ error: "You do not have sufficient rights to perform this action" },
				{ status: 400 }
			);
		}

		// Send request to backend for user creation
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to create user" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error during user creation:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
