import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

function errorMessage(data: { message?: unknown; error?: unknown }, fallback: string): string {
	if (typeof data.error === "string" && data.error) return data.error;
	if (typeof data.message === "string" && data.message) return data.message;
	if (Array.isArray(data.message) && typeof data.message[0] === "string") return data.message[0];
	return fallback;
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ templateId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { templateId } = await params;
		if (!/^\d+$/.test(templateId)) {
			return NextResponse.json({ error: "Template id is required" }, { status: 400 });
		}

		const body = await request.json().catch(() => null);
		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/quick-reply-templates/${encodeURIComponent(templateId)}`;
		const response = await fetch(url, {
			method: "PATCH",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body ?? {}),
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: errorMessage(data, "Failed to save template") },
				{ status: response.status }
			);
		}
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error updating offer quick reply template:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ templateId: string }> }
) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const { templateId } = await params;
		if (!/^\d+$/.test(templateId)) {
			return NextResponse.json({ error: "Template id is required" }, { status: 400 });
		}

		const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/offers/quick-reply-templates/${encodeURIComponent(templateId)}`;
		const response = await fetch(url, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		const data = await response.json().catch(() => ({}));
		if (!response.ok) {
			return NextResponse.json(
				{ error: errorMessage(data, "Failed to delete template") },
				{ status: response.status }
			);
		}
		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error deleting offer quick reply template:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
