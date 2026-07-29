import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string; driverExternalId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { id, driverExternalId } = await params;
		if (!id || !driverExternalId) {
			return NextResponse.json(
				{ error: "Offer id and driver external id are required" },
				{ status: 400 }
			);
		}

		const body = await request.json().catch(() => ({}));
		const counterOffer = body?.counterOffer;
		if (typeof counterOffer !== "number" || !Number.isFinite(counterOffer) || counterOffer < 0) {
			return NextResponse.json(
				{ error: "counterOffer must be a non-negative number" },
				{ status: 400 }
			);
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${encodeURIComponent(id)}/drivers/${encodeURIComponent(driverExternalId)}/counter-offer`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ counterOffer }),
		});

		const data = await response.json();

		if (!response.ok) {
			const errors = Array.isArray(data.errors) ? data.errors : [];
			const errorMessage =
				(typeof errors[0] === "string" ? errors[0] : null) ??
				data.message ??
				data.error ??
				"Failed to save counter offer";
			return NextResponse.json(
				{
					error: errorMessage,
					errors,
					code: data.code ?? undefined,
					message: data.message ?? undefined,
				},
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error saving counter offer:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
