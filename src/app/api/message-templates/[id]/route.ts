import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

/** Proxies DELETE /v1/message-templates/:id → Nest (JWT). */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const templateId = parseInt(id, 10);
		if (!Number.isFinite(templateId) || templateId < 1) {
			return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
		}

		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/message-templates/${templateId}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			}
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			const err = data as { message?: unknown; error?: string };
			const messageStr =
				typeof err.message === "string"
					? err.message
					: err.error ?? "Failed to delete message template";
			return NextResponse.json({ error: messageStr }, { status: response.status });
		}

		return NextResponse.json(data, { status: 200 });
	} catch (error) {
		console.error("Error deleting message template:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
