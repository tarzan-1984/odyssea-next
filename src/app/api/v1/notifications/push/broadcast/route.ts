import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/notifications/push/broadcast`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{
					success: false,
					error: data?.message || data?.error || data?.data?.message || "Failed to start mass push",
				},
				{ status: response.status },
			);
		}

		const payload = data?.data?.data ?? data?.data ?? data;
		return NextResponse.json(payload, { status: 200 });
	} catch (error) {
		console.error("v1/notifications/push/broadcast POST:", error);
		return NextResponse.json(
			{ success: false, error: "Internal server error" },
			{ status: 500 },
		);
	}
}
