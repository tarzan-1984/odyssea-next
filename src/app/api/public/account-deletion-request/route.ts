import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => ({}));

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/public/account-deletion-request`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			}
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: data?.message || data?.error || "Failed to submit request" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("public/account-deletion-request POST:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

