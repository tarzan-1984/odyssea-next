import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

// GET /api/users/external/[externalId] — driver row incl. lastActiveApp (auth).
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ externalId: string }> }
) {
	const { externalId } = await params;

	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const id = externalId?.trim();
		if (!id) {
			return NextResponse.json({ error: "externalId is required" }, { status: 400 });
		}

		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/external/${encodeURIComponent(id)}?role=DRIVER`;

		const response = await fetch(backendUrl, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			cache: "no-store",
		});

		const data = await response.json().catch(() => null);

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string })?.message ||
						(data as { error?: string })?.error ||
						"Failed to fetch user",
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error fetching user by externalId:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
