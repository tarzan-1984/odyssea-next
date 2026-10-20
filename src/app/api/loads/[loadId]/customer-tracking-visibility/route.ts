import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

function readHiddenFlag(body: unknown): boolean | null {
	if (!body || typeof body !== "object") return null;
	const root = body as Record<string, unknown>;
	const payload =
		root.data && typeof root.data === "object" && !Array.isArray(root.data)
			? (root.data as Record<string, unknown>)
			: root;
	if (typeof payload.customerTrackingHidden !== "boolean") return null;
	return payload.customerTrackingHidden;
}

function readError(body: unknown): string | null {
	if (!body || typeof body !== "object") return null;
	const root = body as Record<string, unknown>;
	const payload =
		root.data && typeof root.data === "object" && !Array.isArray(root.data)
			? (root.data as Record<string, unknown>)
			: root;
	for (const value of [payload.message, payload.error, root.message, root.error]) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

// PATCH /api/loads/[loadId]/customer-tracking-visibility
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ loadId: string }> }
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

		const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
		if (typeof body?.hidden !== "boolean") {
			return NextResponse.json({ error: "hidden must be a boolean" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/loads/${encodeURIComponent(loadId)}/customer-tracking-visibility`,
			{
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ hidden: body.hidden }),
				cache: "no-store",
			}
		);

		const data = await response.json().catch(() => null);
		if (!response.ok) {
			return NextResponse.json(
				{ error: readError(data) || "Failed to update tracking visibility" },
				{ status: response.status }
			);
		}

		const customerTrackingHidden = readHiddenFlag(data);
		if (customerTrackingHidden == null) {
			return NextResponse.json({ error: "Failed to update tracking visibility" }, { status: 502 });
		}

		return NextResponse.json({ customerTrackingHidden }, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
