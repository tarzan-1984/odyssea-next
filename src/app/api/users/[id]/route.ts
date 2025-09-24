import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Check if the user is authenticated
		const accessToken = serverAuth.getAccessToken(request);

		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;

		if (!id) {
			return NextResponse.json({ error: "User Email is required" }, { status: 400 });
		}

		// Send request to backend for user by ID
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL_TWO}/v1/driver/?id=${id}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					// Authorization: `Bearer ${accessToken}`,
					"X-API-Key": `${process.env.TMS_API_KEY}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to fetch user" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Check if the user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		const body = await request.json();

		if (!id) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		// Send request to backend for user update
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL_TWO}/v1/driver/update?driver_id=${id}&user_id=1`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					// Authorization: `Bearer ${accessToken}`,
					"X-API-Key": `${process.env.TMS_API_KEY}`,
				},
				body: JSON.stringify(body),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to update user" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Check if the user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		const body = await request.json();
		const { role } = body;

		if (!id) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		// Check if a user has the admin role
		if (role !== "ADMINISTRATOR") {
			return NextResponse.json(
				{ error: "You do not have sufficient rights to perform this action" },
				{ status: 400 }
			);
		}

		// Send request to backend for user deletion
		const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/${id}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to delete user" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
