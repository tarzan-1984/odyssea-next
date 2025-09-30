import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();

		// Extract parameters from request body
		const page = body.page || 1;
		const limit = body.limit || 10;
		const search = body.search;
		const sort = body.sort;
		const role = body.role || "DRIVER"; // Default to DRIVER role

		// Build query string for backend
		const queryParams = new URLSearchParams();
		if (page) queryParams.append("page", page.toString());
		if (limit) queryParams.append("limit", limit.toString());
		if (search) queryParams.append("search", search);
		if (sort) queryParams.append("sort", JSON.stringify(sort));
		if (role) queryParams.append("role", role);

		// Send request to backend for user list
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users?${queryParams.toString()}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to fetch users" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during users fetch:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
