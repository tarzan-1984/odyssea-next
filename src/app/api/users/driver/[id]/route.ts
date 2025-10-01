import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json(
				{ error: "Authentication required" },
				{ status: 401 }
			);
		}

		const { id } = await params;

		if (!id) {
			return NextResponse.json(
				{ error: "Driver ID is required" },
				{ status: 400 }
			);
		}

		// Send request to external TMS API for driver by ID
		const response = await fetch(
			`https://www.endurance-tms.com/wp-json/tms/v1/driver?id=${id}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": "tms_api_key_2024_driver_access",
				},
			}
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || "Failed to fetch driver from TMS" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching driver from TMS:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

