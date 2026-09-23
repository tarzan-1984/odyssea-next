import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> },
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { loadId } = await params;
		if (!loadId?.trim()) {
			return NextResponse.json({ error: "Load id is required" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/loads/${encodeURIComponent(loadId)}/rest/remove`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to remove rest state" },
				{ status: response.status },
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
