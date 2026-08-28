import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canPresignLocally, deleteWasabiObjectByUrl } from "@/server/storage/wasabiPresign";

// DELETE /api/storage/object?url=...
export async function DELETE(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const fileUrl = request.nextUrl.searchParams.get("url")?.trim();
		if (!fileUrl) {
			return NextResponse.json({ error: "url is required" }, { status: 400 });
		}

		if (canPresignLocally()) {
			try {
				await deleteWasabiObjectByUrl(fileUrl);
				return NextResponse.json({ deleted: true }, { status: 200 });
			} catch (error) {
				const message = error instanceof Error ? error.message : "Failed to delete object";
				return NextResponse.json({ error: message }, { status: 400 });
			}
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/storage/object?url=${encodeURIComponent(fileUrl)}`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
				cache: "no-store",
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.message || data.error || "Failed to delete object" },
				{ status: response.status },
			);
		}

		const payload = data?.data ?? data;
		return NextResponse.json(payload, { status: 200 });
	} catch (error) {
		console.error("Error deleting storage object:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
