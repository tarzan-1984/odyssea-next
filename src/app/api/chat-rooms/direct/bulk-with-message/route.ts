import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";
import { canAccessCheckList } from "@/utils/roleAccess";

type BulkDirectChatsWithMessageResponse = {
	created: number;
	existed: number;
	errors: number;
	messagesSent?: number;
	messageErrors?: number;
	items: Array<{
		driverUserId: string;
		status: "created" | "existed" | "error";
		chatRoom?: unknown;
		messageSent?: boolean;
		messageId?: string;
		messageError?: string;
	}>;
};

export async function POST(request: NextRequest) {
	try {
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const userData = serverAuth.getUserData(request);
		if (!canAccessCheckList(userData?.role)) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const body = (await request.json()) as {
			driverUserIds?: unknown;
			message?: unknown;
		};
		const driverUserIds = Array.isArray(body?.driverUserIds)
			? body.driverUserIds.filter((id): id is string => typeof id === "string" && id.trim() !== "")
			: [];
		const message = typeof body?.message === "string" ? body.message : undefined;

		if (driverUserIds.length === 0) {
			return NextResponse.json(
				{ error: "At least one driver user id is required" },
				{ status: 400 }
			);
		}

		if (driverUserIds.length > 50) {
			return NextResponse.json(
				{ error: "Cannot create more than 50 chats at once" },
				{ status: 400 }
			);
		}

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/chat-rooms/direct/bulk-with-message`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({
					driverUserIds,
					...(message !== undefined ? { message } : {}),
				}),
			}
		);

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			return NextResponse.json(
				{
					error:
						(data as { message?: string })?.message ||
						(data as { error?: string })?.error ||
						"Failed to create private chats",
				},
				{ status: response.status }
			);
		}

		const payload = ((data as { data?: BulkDirectChatsWithMessageResponse })?.data ??
			data) as BulkDirectChatsWithMessageResponse;

		return NextResponse.json(payload, { status: 200 });
	} catch (error) {
		console.error("Error during bulk direct chat with message:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
