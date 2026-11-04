import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

const QUICK_REPLY_TEMPLATES = new Set([
	"checking",
	"considering",
	"eta",
	"negotiable",
	"availability",
]);

export async function POST(
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
		const template = typeof body?.template === "string" ? body.template.trim() : "";
		if (!QUICK_REPLY_TEMPLATES.has(template)) {
			return NextResponse.json({ error: "Unknown quick reply" }, { status: 400 });
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/${encodeURIComponent(id)}/drivers/${encodeURIComponent(driverExternalId)}/quick-reply`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ template }),
		});

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message ?? data.error ?? "Failed to send message" },
				{ status: response.status }
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error sending offer quick reply:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
