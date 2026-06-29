import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/**
 * PATCH /api/offers/[id]
 * Proxies update-offer payload to backend PATCH /v1/offers/:id.
 * Requires authentication.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id } = await params;
		if (!id) {
			return NextResponse.json({ error: "Offer id is required" }, { status: 400 });
		}

		const body = await request.json();

		const externalId =
			typeof body?.externalId === "string" ? body.externalId.trim() : "";
		if (!externalId) {
			return NextResponse.json(
				{
					error: "externalId is required and cannot be empty",
					errors: ["externalId must be set (creator TMS id / external_user_id)"],
				},
				{ status: 400 }
			);
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${encodeURIComponent(id)}`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(body),
		});

		const data = await response.json();

		if (!response.ok) {
			const errorMessage = data.message ?? data.error ?? "Failed to update offer";
			const errors = Array.isArray(data.errors) ? data.errors : [];
			return NextResponse.json(
				{ error: errorMessage, errors },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error during offer update:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
