import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/utils/auth";

function parseBackendError(errorText: string): string {
	let errorMessage = errorText;
	try {
		const parsed = JSON.parse(errorText) as { message?: string; error?: string };
		errorMessage = parsed.message || parsed.error || errorText;
	} catch {
		// keep raw text
	}
	return errorMessage;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: messageId } = await params;

		if (!messageId) {
			return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
		}

		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		const body = await request.json().catch(() => ({}));
		const content = typeof body.content === "string" ? body.content : "";

		const response = await fetch(
			`${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/${messageId}`,
			{
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${accessToken}`,
				},
				body: JSON.stringify({ content }),
			}
		);

		if (!response.ok) {
			const errorText = await response.text();
			return NextResponse.json(
				{ error: parseBackendError(errorText) },
				{ status: response.status }
			);
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error updating message:", error);
		return NextResponse.json({ error: "Failed to update message" }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { id: messageId } = await params;

		if (!messageId) {
			return NextResponse.json({ error: "Message ID is required" }, { status: 400 });
		}

		// Check if user is authenticated
		const accessToken = serverAuth.getAccessToken(request);
		if (!accessToken) {
			return NextResponse.json({ error: "Authentication required" }, { status: 401 });
		}

		// Forward request to backend
		const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/v1/messages/${messageId}`;

		const response = await fetch(backendUrl, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`,
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			return NextResponse.json({ error: parseBackendError(errorText) }, { status: response.status });
		}

		const data = await response.json();
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error deleting message:", error);
		return NextResponse.json({ error: "Failed to delete message" }, { status: 500 });
	}
}
