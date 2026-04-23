import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function GET(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/app-settings/account-deletion-request`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			const errMsg =
				(typeof data.message === "string" ? data.message : null) ??
				(typeof data.error === "string" ? data.error : null) ??
				"Failed to load settings";
			return NextResponse.json({ error: errMsg }, { status: response.status });
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("account-deletion-request GET:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/app-settings/account-deletion-request`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify(body),
			}
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			const errMsg =
				(typeof data.message === "string" ? data.message : null) ??
				(typeof data.error === "string" ? data.error : null) ??
				"Failed to save settings";
			return NextResponse.json({ error: errMsg }, { status: response.status });
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("account-deletion-request PUT:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

