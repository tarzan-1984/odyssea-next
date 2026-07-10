import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canManageCheckListDevices } from "@/utils/roleAccess";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/users/user-devices/:id
 * Soft-deletes a driver device from the check list admin UI.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canManageCheckListDevices(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const { id } = await context.params;
		if (!id?.trim()) {
			return NextResponse.json({ error: "Device id is required" }, { status: 400 });
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/users/user-devices/${encodeURIComponent(id)}`,
			{
				method: "DELETE",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
			},
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string }).message ||
						(data as { error?: string }).error ||
						"Failed to delete device",
				},
				{ status: response.status },
			);
		}

		return NextResponse.json(data, { status: 200 });
	} catch {
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
