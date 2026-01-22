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
		const roles = body.roles; // Roles filter - can be array or comma-separated string
		const status = body.status; // Status filter - if not provided, backend will default to ACTIVE
		const contactsOnly = body.contactsOnly; // When true, backend returns only ACTIVE users

		// Build query string for backend
		const queryParams = new URLSearchParams();
		if (page) queryParams.append("page", page.toString());
		if (limit) queryParams.append("limit", limit.toString());
		if (search) queryParams.append("search", search);
		if (sort) queryParams.append("sort", JSON.stringify(sort));
		// Handle roles - convert array to comma-separated string if needed
		if (roles) {
			if (Array.isArray(roles) && roles.length > 0) {
				queryParams.append("roles", roles.join(","));
			} else if (typeof roles === "string" && roles !== "") {
				queryParams.append("roles", roles);
			}
		}
		if (status && status !== "") queryParams.append("status", status); // Only add status if it's not empty
		if (contactsOnly) queryParams.append("contactsOnly", "true");

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
