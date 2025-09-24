import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		const body = await request.json();
		const { status, role } = body;

		if (role !== "ADMINISTRATOR") {
			return NextResponse.json(
				{ error: "You do not have sufficient rights to perform this action" },
				{ status: 400 }
			);
		}

		if (!id) {
			return NextResponse.json({ error: "User ID is required" }, { status: 400 });
		}

		if (!status) {
			return NextResponse.json({ error: "Status is required" }, { status: 400 });
		}

		// Send request to backend for user status change
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/${id}/status`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ status }),
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to change user status" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
