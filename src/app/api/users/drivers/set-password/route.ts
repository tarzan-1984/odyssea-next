import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json();
		const { externalId, password, otp } = body ?? {};

		if (!externalId || !password || !otp) {
			return NextResponse.json(
				{ error: "externalId, password, and otp are required" },
				{ status: 400 },
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/drivers/set-password`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ externalId, password, otp }),
			},
		);

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to set driver password" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
